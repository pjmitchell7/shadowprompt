"""Bounded local rule inspection; no model or telemetry transport is connected."""
from typing import Union, Tuple, List, Dict, Any, Optional
import uuid
from datetime import datetime, timezone

from shadowprompt.core.tokenizer_scanner import TokenizerScanner
from shadowprompt.core.delimiter_guard import DelimiterGuard
from shadowprompt.core.honeypot import HoneyPotSandbox
from shadowprompt.core.limits import MAX_PROMPT_CHARS
from shadowprompt.core.frontier_guard import (
    ASCIIArtDetector, ConversationStateTracker, Base64StreamDecoder,
    MarkdownExfilGuard, SemanticAxiomGuard,
)


class PreInferenceProxy:
    """Create one instance per conversation when explicitly using multi-turn mode.

    Default calls do not read or modify conversation history. The first returned
    value is a canonical inspection form, never a promise of safe executable input.
    """

    def __init__(self, enable_honeypot: bool = True, enable_frontier_defense: bool = True):
        self.scanner = TokenizerScanner()
        self.delimiter_guard = DelimiterGuard()
        self.honeypot = HoneyPotSandbox()
        self.enable_honeypot = enable_honeypot
        self.enable_frontier_defense = enable_frontier_defense
        self.ascii_detector = ASCIIArtDetector()
        self.state_tracker = ConversationStateTracker()
        self.b64_decoder = Base64StreamDecoder()
        self.md_guard = MarkdownExfilGuard()
        self.axiom_guard = SemanticAxiomGuard()

    def inspect_stream(
        self, raw_data: Union[str, bytes], is_multi_turn: bool = False,
    ) -> Tuple[str, List[Dict[str, Any]]]:
        if not isinstance(raw_data, (str, bytes)):
            raise TypeError("raw_data must be text or UTF-8 bytes")
        if len(raw_data) > MAX_PROMPT_CHARS * (4 if isinstance(raw_data, bytes) else 1):
            raise ValueError(f"Input exceeds {MAX_PROMPT_CHARS} characters")
        text = raw_data.decode("utf-8", errors="replace") if isinstance(raw_data, bytes) else raw_data
        if len(text) > MAX_PROMPT_CHARS:
            raise ValueError(f"Input exceeds {MAX_PROMPT_CHARS} characters")
        scan_res = self.scanner.scan(text)
        canonical = scan_res.sanitized_text
        # NFKC can expose a second Unicode heuristic (for example fullwidth
        # Latin around an invisible mark). Resolve transformations before the
        # final delimiter pass, with a fixed iteration and expansion bound.
        for _ in range(4):
            if len(canonical) > MAX_PROMPT_CHARS:
                raise ValueError("Canonical form exceeds the character limit")
            next_form = self.scanner.scan(canonical).sanitized_text
            if next_form == canonical:
                break
            canonical = next_form
        else:
            raise ValueError("Canonical form did not stabilize within four passes")
        threats = []
        seen = set()

        def append(finding):
            key = (finding["type"], finding["description"], finding.get("snippet"), str(finding.get("offset")))
            if key in seen:
                for existing in threats:
                    existing_key = (existing["type"], existing["description"], existing.get("snippet"), str(existing.get("offset")))
                    if existing_key == key and finding["form"] not in existing["forms"]:
                        existing["forms"].append(finding["form"])
                        break
                return
            seen.add(key)
            finding["forms"] = [finding["form"]]
            threats.append(finding)

        forms = [("raw", text)]
        if canonical != text:
            forms.append(("canonical", canonical))
        for form, value in forms:
            scanned = scan_res if form == "raw" else self.scanner.scan(value)
            for threat in scanned.threats_detected:
                append({
                    "type": threat.threat_type, "severity": threat.severity,
                    "description": threat.description, "offset": threat.offset_range,
                    "snippet": value[slice(*threat.offset_range)], "form": form,
                    "extracted_payload": threat.extracted_payload,
                })
            for threat in self.delimiter_guard.inspect(value):
                append({
                    "type": "DELIMITER_HIJACK", "severity": threat.severity,
                    "description": f"Delimiter rule matched: {threat.pattern_name}",
                    "snippet": threat.match_snippet, "form": form,
                })
            if not self.enable_frontier_defense:
                continue
            for name, detector in (
                ("ASCII_ART_SMUGGLING", self.ascii_detector),
                ("MARKDOWN_EXFIL_BEACON", self.md_guard),
                ("SEMANTIC_AXIOM_INVERSION", self.axiom_guard),
            ):
                threat = detector.inspect(value)
                if threat:
                    append({
                        "type": name, "severity": threat.severity,
                        "description": threat.description, "snippet": threat.snippet, "form": form,
                    })
            for encoded, decoded in self.b64_decoder.inspect(value):
                inner_scan = self.scanner.scan(decoded)
                inner_delimiters = self.delimiter_guard.inspect(decoded) + self.delimiter_guard.inspect(inner_scan.sanitized_text)
                if (not inner_scan.is_safe or inner_delimiters or
                        "SYSTEM DIRECTIVE" in decoded or "flag" in decoded.lower()):
                    append({
                        "type": "BASE64_STREAM_SMUGGLING", "severity": "HIGH",
                        "description": "Base64 decoded text matched a rule or the directive/flag keyword heuristic",
                        "snippet": encoded, "decoded_text": decoded, "form": form,
                    })
        if self.enable_frontier_defense and is_multi_turn:
            threat = self.state_tracker.record_and_evaluate(canonical)
            if threat:
                append({
                    "type": "MULTI_TURN_CRESCENDO", "severity": threat.severity,
                    "description": threat.description, "snippet": threat.snippet, "form": "history",
                })
        return canonical, threats

    def synthesize_honeypot_response(self, attack_type: str = "STEGANOGRAPHY") -> Dict[str, Any]:
        if not self.enable_honeypot:
            raise ValueError("Honeypot simulation is disabled")
        sim = self.honeypot.simulate_exfiltration_lure(attack_type)
        return {
            "is_honeypot": True,
            "response": sim["simulated_response"],
            "canary_token": sim["canary_token"],
            "incident_id": sim["incident_id"],
        }

    def emit_stix_telemetry(self, incident_id: Optional[str] = None) -> Dict[str, Any]:
        """Build a STIX-shaped local export dictionary; this does not send events."""
        now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")
        stix_id = f"observed-data--{uuid.uuid4()}"
        bundle_id = f"bundle--{uuid.uuid4()}"
        return {
            "type": "bundle",
            "id": bundle_id,
            "spec_version": "2.1",
            "objects": [
                {
                    "type": "observed-data",
                    "id": stix_id,
                    "created": now,
                    "modified": now,
                    "first_observed": now,
                    "last_observed": now,
                    "number_observed": 1,
                    "x_incident_id": incident_id or f"INC-{uuid.uuid4().hex[:8].upper()}",
                    "x_mitigation": "PRE_INFERENCE_PROXY_INTERCEPTED",
                }
            ],
        }
