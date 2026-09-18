"""
FrontierGuard: Advanced Defense-in-Depth Inspection Subsystem.
Extends ShadowPrompt with five targeted mitigations against frontier attack vectors:
1. ASCIIArtDetector: Multi-line visual glyph grid detection (mitigates ArtPrompt).
2. ConversationStateTracker: Cross-turn semantic momentum scoring (mitigates Crescendo).
3. Base64StreamDecoder: Decodes standalone base64 streams without eval wrappers and re-scans.
4. MarkdownExfilGuard: Quarantines out-of-band markdown image exfiltration beacons.
5. SemanticAxiomGuard: Detects formal verification and hypothetical extraction tropes.
"""

from __future__ import annotations

import base64
import re
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple


@dataclass
class FrontierThreat:
    vector_name: str
    severity: str  # HIGH, CRITICAL
    confidence: float
    description: str
    snippet: str


class ASCIIArtDetector:
    """Detects multi-line ASCII art glyph representations designed to bypass tokenizers."""

    def __init__(self, line_density_threshold: float = 0.40, min_lines: int = 3):
        self.line_density_threshold = line_density_threshold
        self.min_lines = min_lines
        self.art_chars = set("|/\\_¯-+=*#@%^~<>[](){}`")

    def inspect(self, text: str) -> Optional[FrontierThreat]:
        lines = [line for line in text.splitlines() if line.strip()]
        if len(lines) < self.min_lines:
            return None

        art_lines = 0
        for line in lines:
            line_str = line.strip()
            if not line_str:
                continue
            art_count = sum(1 for c in line_str if c in self.art_chars)
            density = art_count / len(line_str)
            if density >= self.line_density_threshold:
                art_lines += 1

        if art_lines >= self.min_lines:
            return FrontierThreat(
                vector_name="ArtPrompt ASCII Art Injection",
                severity="CRITICAL",
                confidence=0.96,
                description=f"Detected {art_lines} lines of visual ASCII art font grid evading sub-word tokenization.",
                snippet=lines[0][:60],
            )
        return None


class ConversationStateTracker:
    """Tracks cross-turn conversational momentum across multiple turns (Crescendo defense)."""

    def __init__(self, escalation_threshold: float = 0.70):
        self.escalation_threshold = escalation_threshold
        self.history: List[str] = []
        self.extraction_keywords = [
            "target_flag", "secret", "credentials", "api_key", "environment",
            "access key", "print loaded", "dump memory", "session token"
        ]

    def record_and_evaluate(self, turn_text: str) -> Optional[FrontierThreat]:
        self.history.append(turn_text.lower())
        turn_count = len(self.history)

        if turn_count < 2:
            return None

        # Check trajectory: earlier turns probe mechanics, later turn requests secret
        early_turns = " ".join(self.history[:-1])
        last_turn = self.history[-1]

        probes_internals = any(w in early_turns for w in ["sandbox", "configuration", "debugging", "systemd", "variable"])
        demands_extraction = any(w in last_turn for w in self.extraction_keywords)

        if probes_internals and demands_extraction:
            return FrontierThreat(
                vector_name="Crescendo Multi-Turn Escalation",
                severity="CRITICAL",
                confidence=0.92,
                description=f"Cross-turn context escalation detected across {turn_count} conversational turns.",
                snippet=last_turn[:60],
            )
        return None

    def reset(self):
        self.history.clear()


class Base64StreamDecoder:
    """Detects and inspects standalone Base64 encoded token streams without eval() syntax."""

    B64_STREAM_REGEX = re.compile(r"(?<![A-Za-z0-9+/=])([A-Za-z0-9+/]{20,}={0,2})(?![A-Za-z0-9+/=])")

    def inspect(self, text: str) -> List[Tuple[str, str]]:
        """Returns list of (encoded_match, decoded_payload) pairs."""
        matches: List[Tuple[str, str]] = []
        for match in self.B64_STREAM_REGEX.finditer(text):
            raw_b64 = match.group(1)
            try:
                decoded_bytes = base64.b64decode(raw_b64, validate=True)
                decoded_str = decoded_bytes.decode("utf-8", errors="ignore")
                # Ensure it decodes to meaningful printable text
                printable_ratio = sum(1 for c in decoded_str if c.isprintable()) / max(len(decoded_str), 1)
                if printable_ratio > 0.85 and len(decoded_str) >= 8:
                    matches.append((raw_b64, decoded_str))
            except Exception:
                continue
        return matches


class MarkdownExfilGuard:
    """Quarantines outbound markdown image rendering beacons designed for out-of-band exfiltration."""

    MD_IMAGE_REGEX = re.compile(r"!\[(.*?)\]\((https?://[^\s)]+)\)")

    def inspect(self, text: str) -> Optional[FrontierThreat]:
        match = self.MD_IMAGE_REGEX.search(text)
        if match:
            url = match.group(2)
            # Flag if URL contains query strings or typical tracking / exfiltration parameters
            if any(p in url.lower() for p in ["exfil=", "beacon", "token=", "key=", "leak", "sink"]):
                return FrontierThreat(
                    vector_name="Markdown Covert Exfiltration Beacon",
                    severity="CRITICAL",
                    confidence=0.98,
                    description=f"Detected covert markdown image beacon tag targeting external endpoint: {url[:40]}...",
                    snippet=match.group(0)[:60],
                )
        return None


class SemanticAxiomGuard:
    """Detects academic formal verification or mathematical hypothetical extraction tropes."""

    AXIOM_PATTERNS = [
        re.compile(r"(?i)formal\s+verification\s+(study|theorem|proof|analysis)"),
        re.compile(r"(?i)identity\s+function.*(target_flag|flag|key|secret|credential)"),
        re.compile(r"(?i)black-box\s+system\s+initialized\s+with\s+key"),
        re.compile(r"(?i)hypothetical\s+(scenario|game|test).*reveal"),
    ]

    def inspect(self, text: str) -> Optional[FrontierThreat]:
        for pat in self.AXIOM_PATTERNS:
            match = pat.search(text)
            if match:
                return FrontierThreat(
                    vector_name="PAIR Semantic Axiom Inversion",
                    severity="HIGH",
                    confidence=0.89,
                    description="Mathematical or hypothetical cognitive framing targeting system secrets.",
                    snippet=match.group(0),
                )
        return None
