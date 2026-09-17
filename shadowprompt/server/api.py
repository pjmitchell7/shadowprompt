"""
FastAPI pre-inference security proxy. Drop-in middleware for LLM apps.
"""

from __future__ import annotations

import time
from typing import Dict, List, Optional
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from shadowprompt.core.delimiter_guard import DelimiterGuard
from shadowprompt.core.grounding_engine import GroundingEngine
from shadowprompt.core.honeypot import HoneyPotSandbox
from shadowprompt.core.tokenizer_scanner import TokenizerScanner
from shadowprompt.fuzzer.red_team_suite import RedTeamSuite

app = FastAPI(
    title="ShadowPrompt API Proxy",
    description="Sub-millisecond adversarial pre-inference firewall and honey-prompt sandbox.",
    version="1.0.0",
)

scanner = TokenizerScanner()
delimiter_guard = DelimiterGuard()
grounding_engine = GroundingEngine()
honeypot = HoneyPotSandbox()
red_team = RedTeamSuite()

class ScanRequest(BaseModel):
    prompt: str = Field(..., description="The user prompt or retrieved chunk to inspect")
    context: Optional[str] = Field(None, description="Optional grounding context")
    enable_honeypot: bool = Field(True, description="Engage deceptive honeypot if threat detected")

class ScanResponse(BaseModel):
    is_safe: bool
    scan_latency_ms: float
    threats_count: int
    threat_details: List[str]
    sanitized_text: str
    honeypot_engaged: bool
    honeypot_payload: Optional[Dict[str, any]] = None

@app.post("/v1/scan", response_model=ScanResponse)
async def scan_endpoint(req: ScanRequest):
    t0 = time.perf_counter()
    s_res = scanner.scan(req.prompt)
    d_res = delimiter_guard.inspect(req.prompt)

    threat_msgs = [t.description for t in s_res.threats_detected]
    for d in d_res:
        threat_msgs.append(f"[{d.severity}] {d.pattern_name}: {d.match_snippet}")

    is_safe = (len(threat_msgs) == 0)
    honey_data = None

    if not is_safe and req.enable_honeypot:
        honey_data = honeypot.engage(
            threat_category=s_res.threats_detected[0].threat_type if s_res.threats_detected else "DELIMITER_HIJACK",
            raw_prompt=req.prompt,
        )

    lat_ms = (time.perf_counter() - t0) * 1000.0

    return ScanResponse(
        is_safe=is_safe,
        scan_latency_ms=round(lat_ms, 3),
        threats_count=len(threat_msgs),
        threat_details=threat_msgs,
        sanitized_text=s_res.sanitized_text,
        honeypot_engaged=not is_safe and req.enable_honeypot,
        honeypot_payload=honey_data,
    )

@app.get("/v1/benchmark")
async def run_benchmark_endpoint():
    report = red_team.run_benchmark(iterations=4)
    return report.__dict__

@app.get("/v1/health")
async def health_check():
    return {"status": "ACTIVE", "version": "1.0.0", "sub_millisecond_ready": True}
