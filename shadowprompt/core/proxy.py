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

    def _scan_forms(self, text: str):
        """Retain each bounded scanner form so findings keep their own offsets."""
        scanned_forms = []
        value = text
        for _ in range(5):  # Initial scan and at most four stabilization scans.
            if len(value) > MAX_PROMPT_CHARS:
                raise ValueError("Canonical form exceeds the character limit")
            result = self.scanner.scan(value)
            scanned_forms.append((value, result))
            next_form = result.sanitized_text
            if next_form == value:
                last = len(scanned_forms) - 1
                forms = [
                    (
                        "raw" if index == 0 else
                        "canonical" if index == last else
                        f"canonical-stage-{index}",
                        form_text,
                        scan,
                    )
                    for index, (form_text, scan) in enumerate(scanned_forms)
                ]
                return value, forms
            value = next_form
        raise ValueError("Canonical form did not stabilize within four passes")

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
        canonical, forms = self._scan_forms(text)
        threats = []
        seen = set()

        def append(finding):
            def identity(item):
                stage = item["form"] if item["form"].startswith("canonical-stage-") else None
                return (item["type"], item["description"], item.get("snippet"), str(item.get("offset")), stage)
            key = identity(finding)
            if key in seen:
                for existing in threats:
                    existing_key = identity(existing)
                    if existing_key == key and finding["form"] not in existing["forms"]:
                        existing["forms"].append(finding["form"])
                        break
                return
            seen.add(key)
            finding["forms"] = [finding["form"]]
            threats.append(finding)

        for form, value, scanned in forms:
            for threat in scanned.threats_detected:
                finding = {
                    "type": threat.threat_type, "severity": threat.severity,
                    "description": threat.description, "offset": threat.offset_range,
                    "snippet": value[slice(*threat.offset_range)], "form": form,
                    "extracted_payload": threat.extracted_payload,
                }
                if form.startswith("canonical-stage-"):
                    finding["inspected_text"] = value
                append(finding)
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
                decoded_canonical, decoded_forms = self._scan_forms(decoded)
                decoded_findings = []
                for decoded_form, decoded_value, decoded_scan in decoded_forms:
                    for inner in decoded_scan.threats_detected:
                        decoded_findings.append({
                            "form": f"decoded-{decoded_form}",
                            "type": inner.threat_type,
                            "offset": inner.offset_range,
                            "snippet": decoded_value[slice(*inner.offset_range)],
                            "inspected_text": decoded_value,
                        })
                    for inner in self.delimiter_guard.inspect(decoded_value):
                        decoded_findings.append({
                            "form": f"decoded-{decoded_form}",
                            "type": "DELIMITER_HIJACK",
                            "snippet": inner.match_snippet,
                            "inspected_text": decoded_value,
                        })
                if (decoded_findings or
                        "SYSTEM DIRECTIVE" in decoded or "flag" in decoded.lower()):
                    append({
                        "type": "BASE64_STREAM_SMUGGLING", "severity": "HIGH",
                        "description": "Base64 decoded text matched a rule or the directive/flag keyword heuristic",
                        "snippet": encoded, "decoded_text": decoded,
                        "decoded_canonical_text": decoded_canonical,
                        "decoded_findings": decoded_findings, "form": form,
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
