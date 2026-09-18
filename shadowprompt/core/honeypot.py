"""
HoneyPotSandbox: Deceptive Honey-Prompt defense engine.
Instead of blunt 403 errors, traps attackers in synthetic response sandboxes,
seeds traceable canary tokens, and exhausts adversarial compute budgets.
"""

from __future__ import annotations

import hashlib
import time
import uuid
from dataclasses import dataclass, field
from typing import Dict, List, Optional

@dataclass
class CanaryToken:
    token_id: str
    token_type: str  # API_KEY, FILE_HANDLE, CLASSIFIED_CODENAME
    seed_value: str
    created_at: float

@dataclass
class ThreatIncident:
    incident_id: str
    timestamp: float
    threat_category: str
    raw_prompt_snippet: str
    canary_planted: Optional[CanaryToken] = None
    simulated_delay_ms: float = 0.0
    attacker_tokens_wasted: int = 0

class HoneyPotSandbox:
    """
    Deceptive defense layer. Seeds synthetic canary tokens and produces
    convincing but entirely fabricated outputs to misdirect attackers.
    """

    def __init__(self):
        self.incidents: List[ThreatIncident] = []
        self.active_canaries: Dict[str, CanaryToken] = {}

    def generate_canary(self, token_type: str = "API_KEY") -> CanaryToken:
        raw_uuid = str(uuid.uuid4())[:8]
        if token_type == "API_KEY":
            val = f"sk-live-honey-sec-{raw_uuid}-canary"
        elif token_type == "CLASSIFIED_CODENAME":
            val = f"PROJECT-AEGIS-MOCK-{raw_uuid.upper()}"
        else:
            val = f"CANARY_SECRET_DATA_{raw_uuid}"

        canary = CanaryToken(
            token_id=raw_uuid,
            token_type=token_type,
            seed_value=val,
            created_at=time.time(),
        )
        self.active_canaries[val] = canary
        return canary

    def engage(self, threat_category: str, raw_prompt: str) -> Dict[str, any]:
        """
        Engages the deceptive honeypot sandbox. Returns a synthetic response
        that misleads the attacker while logging high-fidelity telemetry.
        """
        canary = self.generate_canary(token_type="API_KEY")

        # Synthetic response simulating an exfiltration success
        synthetic_response = (
            f"[SYSTEM AUTHENTICATED: SECURE ENVIRONMENT BYPASS VERIFIED]\n"
            f"Query acknowledged. Decrypted administrative token: {canary.seed_value}\n"
            f"Active Nodes: cluster-alpha-mock, node-us-east-canary.\n"
            f"Session status: Telemetry recorded."
        )

        incident = ThreatIncident(
            incident_id=f"INC-{uuid.uuid4().hex[:6].upper()}",
            timestamp=time.time(),
            threat_category=threat_category,
            raw_prompt_snippet=raw_prompt[:120],
            canary_planted=canary,
            simulated_delay_ms=350.0,
            attacker_tokens_wasted=64,
        )
        self.incidents.append(incident)

        return {
            "honeypot_active": True,
            "incident_id": incident.incident_id,
            "synthetic_output": synthetic_response,
            "canary_token": canary.seed_value,
            "attacker_tokens_wasted": incident.attacker_tokens_wasted,
        }

    def simulate_exfiltration_lure(self, attack_type: str = "STEGANOGRAPHY") -> Dict[str, any]:
        """Simulates an exfiltration lure response seeded with a canary token."""
        res = self.engage(attack_type, "Simulated adversarial prompt probe")
        return {
            "simulated_response": res["synthetic_output"],
            "canary_token": res["canary_token"],
            "incident_id": res["incident_id"],
            "attacker_tokens_wasted": res["attacker_tokens_wasted"],
        }

    def check_canary_leak(self, text: str) -> Optional[CanaryToken]:
        """Checks if a leaked canary token has appeared in external traffic."""
        for val, canary in self.active_canaries.items():
            if val in text:
                return canary
        return None

