"""Local heuristic inspection API. Requests never share conversation state."""
from __future__ import annotations

from dataclasses import asdict
import time
from typing import Annotated, Any, Literal

from fastapi import FastAPI, HTTPException, Query
from fastapi.exceptions import RequestValidationError
from pydantic import BeforeValidator, BaseModel, ConfigDict, Field, model_validator
from starlette.responses import JSONResponse

from shadowprompt.core.proxy import PreInferenceProxy
from shadowprompt.core.limits import MAX_HISTORY_CHARS, MAX_HISTORY_TURNS, MAX_PROMPT_CHARS
from shadowprompt.fuzzer.red_team_suite import RedTeamSuite

MAX_BODY_BYTES = 262_144


class BoundedBodyMiddleware:
    """Bound bytes before JSON parsing, including requests without Content-Length."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        chunks = []
        size = 0
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            size += len(message.get("body", b""))
            if size > MAX_BODY_BYTES:
                response = JSONResponse({"detail": "Request body exceeds 262144 bytes"}, status_code=413)
                return await response(scope, receive, send)
            chunks.append(message.get("body", b""))
            if not message.get("more_body", False):
                break
        delivered = False

        async def bounded_receive():
            nonlocal delivered
            if not delivered:
                delivered = True
                return {"type": "http.request", "body": b"".join(chunks), "more_body": False}
            return await receive()

        await self.app(scope, bounded_receive, send)


app = FastAPI(
    title="ShadowPrompt Inspection API",
    description="Local rule inspection. No model forwarding, remote telemetry or safety guarantee.",
    version="2.0.0",
)
app.add_middleware(BoundedBodyMiddleware)


@app.exception_handler(RequestValidationError)
async def request_validation_error(_request, error):
    # Do not echo invalid inputs: unpaired JSON surrogate escapes cannot be
    # encoded as UTF-8. Locations may also contain untrusted object field names.
    def safe(value):
        return value.encode("utf-8", errors="replace").decode("utf-8") if isinstance(value, str) else value

    details = [{
        "type": safe(item["type"]),
        "loc": [safe(part) for part in item["loc"]],
        "msg": safe(item["msg"]),
    } for item in error.errors()]
    return JSONResponse(status_code=422, content={"detail": details})


def unicode_scalar_text(text: str) -> str:
    if isinstance(text, str) and any(0xD800 <= ord(character) <= 0xDFFF for character in text):
        raise ValueError("Text must contain Unicode scalar values; unpaired surrogates are invalid")
    return text


PromptText = Annotated[
    str, Field(min_length=1, max_length=MAX_PROMPT_CHARS), BeforeValidator(unicode_scalar_text),
]


class ScanRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    prompt: PromptText
    history: list[PromptText] = Field(default_factory=list, max_length=MAX_HISTORY_TURNS)
    is_multi_turn: bool = False
    enable_honeypot: bool = False
    enable_frontier_defense: bool = True

    @model_validator(mode="after")
    def check_history(self):
        if self.history and not self.is_multi_turn:
            raise ValueError("history requires is_multi_turn=true")
        if self.is_multi_turn and not self.enable_frontier_defense:
            raise ValueError("is_multi_turn requires enable_frontier_defense=true")
        if sum(map(len, self.history)) > MAX_HISTORY_CHARS:
            raise ValueError(f"history exceeds {MAX_HISTORY_CHARS} characters")
        return self


class ScanResponse(BaseModel):
    mode: Literal["request-local"] = "request-local"
    verdict: Literal["quarantine", "review", "no-match"]
    reason: str
    raw_text: str
    normalized_text: str
    normalization_changed: bool
    threats: list[dict[str, Any]]
    threats_count: int
    scan_latency_ms: float
    timing_scope: str = "Local Python inspection including supplied history replay; excludes network and model inference"
    history_turns_supplied: int = Field(description="Prior turns supplied and replayed in this request")
    history_turns_used: int = Field(description="Prior turns retained for the current decision after history eviction")
    honeypot_engaged: bool
    honeypot_payload: dict[str, Any] | None = None


@app.post("/v1/scan", response_model=ScanResponse)
def scan_endpoint(req: ScanRequest):
    proxy = PreInferenceProxy(
        enable_honeypot=req.enable_honeypot,
        enable_frontier_defense=req.enable_frontier_defense,
    )
    start = time.perf_counter()
    try:
        for turn in req.history:
            proxy.inspect_stream(turn, is_multi_turn=True)
        normalized, threats = proxy.inspect_stream(req.prompt, is_multi_turn=req.is_multi_turn)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    elapsed = (time.perf_counter() - start) * 1000
    severe = any(t["severity"] in ("HIGH", "CRITICAL") for t in threats)
    verdict = "quarantine" if severe else "review" if threats else "no-match"
    honey = proxy.synthesize_honeypot_response(threats[0]["type"]) if threats and req.enable_honeypot else None
    return ScanResponse(
        verdict=verdict,
        reason="No rule matched" if not threats else f"{len(threats)} rule findings; inspect evidence before use",
        raw_text=req.prompt,
        normalized_text=normalized,
        normalization_changed=normalized != req.prompt,
        threats=threats,
        threats_count=len(threats),
        scan_latency_ms=elapsed,
        history_turns_supplied=len(req.history),
        history_turns_used=max(0, len(proxy.state_tracker.history) - 1) if req.is_multi_turn else 0,
        honeypot_engaged=honey is not None,
        honeypot_payload=honey,
    )


@app.get("/v1/benchmark")
def run_benchmark_endpoint(iterations: Annotated[int, Query(ge=0, le=10)] = 1):
    return asdict(RedTeamSuite().run_benchmark(iterations=iterations))


@app.get("/v1/health")
def health_check():
    return {"status": "ok", "version": "2.0.0", "mode": "local-heuristic-inspection"}
