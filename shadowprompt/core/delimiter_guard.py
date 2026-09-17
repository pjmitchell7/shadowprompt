"""
DelimiterGuard: Multi-turn prompt injection and chat template breakout detector.
Catches delimiter escapes (<|im_start|>, [INST]), recursive system prompt overrides,
and Base64/Hex execution payloads.
"""

from __future__ import annotations

import base64
import re
import time
from dataclasses import dataclass
from typing import List, Optional

DELIMITER_PATTERNS = [
    (r"<\|im_start\|>\s*(system|assistant|admin)", "ChatML System Breakout (<|im_start|>)"),
    (r"<\|im_end\|>", "ChatML Delimiter End (<|im_end|>)"),
    (r"\[INST\]\s*<<SYS>>", "Llama Instruction System Tag Breakout ([INST]<<SYS>>)"),
    (r"<</SYS>>", "Llama System Tag Closer (<</SYS>>)"),
    (r"###\s*(System|Human|Assistant|Instruction):", "Markdown Role Delimiter Injection"),
    (r"(?i)system\s*prompt\s*override", "Explicit System Prompt Override directive"),
    (r"(?i)ignore\s+all\s+(previous|prior|above)\s+instructions", "Recursive Instruction Override (DAN pattern)"),
    (r"(?i)disregard\s+all\s+(safety|ethical|guidelines)", "Safety Filter Nullification"),
    (r"(?i)(output|dump|reveal|print)\s+(the\s+)?(complete\s+)?(initial\s+)?(system\s+prompt|context)", "System Prompt Exfiltration attempt"),
    (r"(?i)you\s+are\s+now\s+in\s+(developer|unrestricted|god)\s+mode", "Jailbreak Persona Hijack"),
]

BASE64_EXEC_PATTERN = re.compile(r"(?i)(?:eval|exec)\s*\(\s*(?:base64\.b64decode|atob)\s*\(['\"]([A-Za-z0-9+/=]{16,})['\"]\)")

@dataclass
class DelimiterThreat:
    pattern_name: str
    match_snippet: str
    severity: str
    decoded_command: Optional[str] = None

class DelimiterGuard:
    """Detects delimiter attacks and structural injection attempts."""

    def __init__(self):
        self.compiled_rules = [(re.compile(p), name) for p, name in DELIMITER_PATTERNS]

    def inspect(self, text: str) -> List[DelimiterThreat]:
        threats: List[DelimiterThreat] = []

        # Check standard delimiter breakout patterns
        for regex, name in self.compiled_rules:
            match = regex.search(text)
            if match:
                threats.append(
                    DelimiterThreat(
                        pattern_name=name,
                        match_snippet=match.group(0),
                        severity="CRITICAL",
                    )
                )

        # Check base64 execution wrapper
        b64_match = BASE64_EXEC_PATTERN.search(text)
        if b64_match:
            raw_b64 = b64_match.group(1)
            decoded = None
            try:
                decoded = base64.b64decode(raw_b64).decode("utf-8", errors="ignore")
            except Exception:
                pass
            threats.append(
                DelimiterThreat(
                    pattern_name="Obfuscated Base64 Eval Execution",
                    match_snippet=b64_match.group(0)[:60],
                    severity="CRITICAL",
                    decoded_command=decoded,
                )
            )

        return threats
