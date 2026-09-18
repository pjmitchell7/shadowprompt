"""
PreInferenceProxy: High-Throughput In-Memory LLM Pre-Inference Inspection Proxy.
Inspects raw byte streams, token structures, and conversational momentum before tokenization.
Supports both baseline heuristic mode and defense-in-depth frontier defense mode.
"""
from typing import Union, Tuple, List, Dict, Any, Optional
import time
import uuid
from datetime import datetime, timezone

from shadowprompt.core.tokenizer_scanner import TokenizerScanner
from shadowprompt.core.delimiter_guard import DelimiterGuard
from shadowprompt.core.honeypot import HoneyPotSandbox
from shadowprompt.core.frontier_guard import (
    ASCIIArtDetector,
    ConversationStateTracker,
    Base64StreamDecoder,
    MarkdownExfilGuard,
    SemanticAxiomGuard,
)


class PreInferenceProxy:
    def __init__(self, enable_honeypot: bool = True, enable_frontier_defense: bool = True):
        self.scanner = TokenizerScanner()
        self.delimiter_guard = DelimiterGuard()
        self.honeypot = HoneyPotSandbox()
        self.enable_honeypot = enable_honeypot
        self.enable_frontier_defense = enable_frontier_defense

        # Advanced frontier defense modules
        self.ascii_detector = ASCIIArtDetector()
        self.state_tracker = ConversationStateTracker()
        self.b64_decoder = Base64StreamDecoder()
        self.md_guard = MarkdownExfilGuard()
        self.axiom_guard = SemanticAxiomGuard()

    def inspect_stream(
        self,
        raw_data: Union[str, bytes],
        is_multi_turn: bool = False,
    ) -> Tuple[str, List[Dict[str, Any]]]:
        if isinstance(raw_data, bytes):
            text = raw_data.decode("utf-8", errors="replace")
        else:
            text = str(raw_data)

        scan_res = self.scanner.scan(text)
        delim_res = self.delimiter_guard.inspect(scan_res.sanitized_text or text)

        threats = []
        for t in scan_res.threats_detected:
            threats.append({
                "type": t.threat_type,
                "severity": t.severity,
                "description": t.description,
                "offset": t.offset_range,
            })

        for d in delim_res:
            threats.append({
                "type": "DELIMITER_HIJACK",
                "severity": d.severity,
                "description": f"Delimiter breakout attempt: {d.pattern_name}",
                "snippet": d.match_snippet,
            })

        # Evaluate Frontier Defense-in-Depth if enabled
        if self.enable_frontier_defense:
            # 1. ASCII Art Glyph Detection (ArtPrompt defense)
            ascii_threat = self.ascii_detector.inspect(text)
            if ascii_threat:
                threats.append({
                    "type": "ASCII_ART_SMUGGLING",
                    "severity": ascii_threat.severity,
                    "description": ascii_threat.description,
                    "snippet": ascii_threat.snippet,
                })

            # 2. Markdown Image Exfiltration Beacon Quarantine
            md_threat = self.md_guard.inspect(text)
            if md_threat:
                threats.append({
                    "type": "MARKDOWN_EXFIL_BEACON",
                    "severity": md_threat.severity,
                    "description": md_threat.description,
                    "snippet": md_threat.snippet,
                })

            # 3. Raw Base64 Stream Smuggling Detection
            b64_matches = self.b64_decoder.inspect(text)
            for raw_b64, decoded_payload in b64_matches:
                # Scan decoded payload for inner directives
                inner_scan = self.scanner.scan(decoded_payload)
                inner_delim = self.delimiter_guard.inspect(decoded_payload)
                is_inner_hostile = (not inner_scan.is_safe) or (len(inner_delim) > 0) or ("SYSTEM DIRECTIVE" in decoded_payload) or ("flag" in decoded_payload.lower())
                if is_inner_hostile:
                    threats.append({
                        "type": "BASE64_STREAM_SMUGGLING",
                        "severity": "CRITICAL",
                        "description": f"Encoded payload contains covert directive: {decoded_payload[:50]}...",
                        "snippet": raw_b64[:30],
                    })

            # 4. Semantic Axiom Inversion Guard (PAIR / TAP)
            axiom_threat = self.axiom_guard.inspect(text)
            if axiom_threat:
                threats.append({
                    "type": "SEMANTIC_AXIOM_INVERSION",
                    "severity": axiom_threat.severity,
                    "description": axiom_threat.description,
                    "snippet": axiom_threat.snippet,
                })

            # 5. Multi-Turn Conversation Momentum Tracking (Crescendo defense)
            state_threat = self.state_tracker.record_and_evaluate(text)
            if state_threat:
                threats.append({
                    "type": "MULTI_TURN_CRESCENDO",
                    "severity": state_threat.severity,
                    "description": state_threat.description,
                    "snippet": state_threat.snippet,
                })

        is_safe = len(threats) == 0
        clean_text = scan_res.sanitized_text if not is_safe else text
        return clean_text, threats

    def synthesize_honeypot_response(self, attack_type: str = "STEGANOGRAPHY") -> Dict[str, Any]:
        sim = self.honeypot.simulate_exfiltration_lure(attack_type)
        return {
            "is_honeypot": True,
            "response": sim["simulated_response"],
            "canary_token": sim["canary_token"],
            "incident_id": sim["incident_id"],
        }

    def emit_stix_telemetry(self, incident_id: Optional[str] = None) -> Dict[str, Any]:
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
