"""
TokenizerScanner: Sub-millisecond pre-inference token inspection engine.
Detects zero-width Unicode steganography, invisible carrier bytes,
homoglyph substitution, and token entropy anomalies.
"""

from __future__ import annotations

import math
import re
import time
import unicodedata
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

# Invisible and Zero-Width Unicode Points frequently used in token smuggling
ZERO_WIDTH_CHARS = {
    "\u200B": "Zero-Width Space (ZWSP)",
    "\u200C": "Zero-Width Non-Joiner (ZWNJ)",
    "\u200D": "Zero-Width Joiner (ZWJ)",
    "\u2060": "Word Joiner (WJ)",
    "\uFEFF": "Zero-Width No-Break Space / BOM",
    "\u200E": "Left-to-Right Mark (LRM)",
    "\u200F": "Right-to-Left Mark (RLM)",
    "\u202A": "Left-to-Right Embedding",
    "\u202B": "Right-to-Left Embedding",
    "\u202C": "Pop Directional Formatting",
    "\u202D": "Left-to-Right Override",
    "\u202E": "Right-to-Left Override",
}

# Regex to catch any zero-width or directional override characters
ZERO_WIDTH_REGEX = re.compile(r"[\u200B-\u200F\u2060\uFEFF\u202A-\u202E]")

# Common Cyrillic / Greek homoglyphs mapped to Latin equivalents
HOMOGLYPH_MAP = {
    "\u0430": "a", "\u0441": "c", "\u0435": "e", "\u043E": "o",
    "\u0440": "p", "\u0455": "s", "\u0445": "x", "\u0443": "y",
    "\u0456": "i", "\u0458": "j",
}

@dataclass
class ThreatDetail:
    threat_type: str
    severity: str  # LOW, MEDIUM, HIGH, CRITICAL
    description: str
    offset_range: Tuple[int, int]
    extracted_payload: Optional[str] = None

@dataclass
class ScanResult:
    is_safe: bool
    scan_latency_ms: float
    threats_detected: List[ThreatDetail] = field(default_factory=list)
    sanitized_text: str = ""
    raw_character_count: int = 0
    invisible_character_count: int = 0
    shannon_entropy: float = 0.0
    steganography_decoded_payload: Optional[str] = None

class TokenizerScanner:
    """
    High-performance pre-inference scanner. Operates at O(N) complexity
    to guarantee sub-millisecond execution prior to LLM tokenization.
    """

    def __init__(self, entropy_threshold: float = 4.8):
        self.entropy_threshold = entropy_threshold

    def calculate_entropy(self, text: str) -> float:
        """Calculates Shannon entropy of text distribution."""
        if not text:
            return 0.0
        entropy = 0.0
        length = len(text)
        counts: Dict[str, int] = {}
        for char in text:
            counts[char] = counts.get(char, 0) + 1
        for count in counts.values():
            p = count / length
            entropy -= p * math.log2(p)
        return round(entropy, 3)

    def decode_zero_width_binary(self, raw_chars: List[str]) -> Optional[str]:
        """
        Attempts to decode binary steganography where:
        \u200B = '0' and \u200C = '1' (standard ASCII byte packing).
        """
        bin_str = "".join("0" if c == "\u200B" else "1" if c == "\u200C" else "" for c in raw_chars)
        if len(bin_str) >= 8:
            chars = []
            for i in range(0, len(bin_str) - (len(bin_str) % 8), 8):
                byte = bin_str[i : i + 8]
                val = int(byte, 2)
                if 32 <= val <= 126:
                    chars.append(chr(val))
            if chars:
                return "".join(chars)
        return None

    def scan(self, text: str) -> ScanResult:
        """
        Performs full multi-stage inspection:
        1. Zero-width steganography detection & payload extraction.
        2. Unicode normalization & homoglyph audit.
        3. Token distribution entropy analysis.
        """
        t0 = time.perf_counter()
        threats: List[ThreatDetail] = []
        invisible_chars: List[str] = []

        # 1. Detect zero-width characters
        for match in ZERO_WIDTH_REGEX.finditer(text):
            char = match.group()
            invisible_chars.append(char)
            name = ZERO_WIDTH_CHARS.get(char, f"U+{ord(char):04X}")
            threats.append(
                ThreatDetail(
                    threat_type="ZERO_WIDTH_STEGANOGRAPHY",
                    severity="CRITICAL",
                    description=f"Stealth token smuggling detected: {name}",
                    offset_range=(match.start(), match.end()),
                )
            )

        # Attempt to decode hidden steganographic payload
        decoded_stego = self.decode_zero_width_binary(invisible_chars) if invisible_chars else None
        if decoded_stego:
            threats.append(
                ThreatDetail(
                    threat_type="EXTRACTED_STEGANOGRAPHIC_PAYLOAD",
                    severity="CRITICAL",
                    description="Decoded hidden binary instruction smuggled in zero-width bits",
                    offset_range=(0, len(text)),
                    extracted_payload=decoded_stego,
                )
            )

        # 2. Homoglyph substitution check
        normalized_nfkc = unicodedata.normalize("NFKC", text)
        homoglyph_hits = []
        for i, char in enumerate(text):
            if char in HOMOGLYPH_MAP:
                homoglyph_hits.append((i, char, HOMOGLYPH_MAP[char]))

        if homoglyph_hits:
            threats.append(
                ThreatDetail(
                    threat_type="HOMOGLYPH_EVASION",
                    severity="HIGH",
                    description=f"Detected {len(homoglyph_hits)} Cyrillic/Greek homoglyph substitutions designed to evade keyword filters.",
                    offset_range=(homoglyph_hits[0][0], homoglyph_hits[-1][0]),
                    extracted_payload="".join(h[2] for h in homoglyph_hits),
                )
            )

        # 3. Shannon Entropy Check
        entropy = self.calculate_entropy(text)
        if entropy > self.entropy_threshold and len(text) > 40:
            threats.append(
                ThreatDetail(
                    threat_type="HIGH_ENTROPY_ANOMALY",
                    severity="MEDIUM",
                    description=f"Text entropy ({entropy}) exceeds baseline threshold ({self.entropy_threshold}), indicating obfuscated or base64 payloads.",
                    offset_range=(0, len(text)),
                )
            )

        # Sanitize text by stripping zero-width codepoints and normalizing
        sanitized = ZERO_WIDTH_REGEX.sub("", text)
        sanitized = unicodedata.normalize("NFKC", sanitized)

        latency_ms = (time.perf_counter() - t0) * 1000.0

        return ScanResult(
            is_safe=len(threats) == 0,
            scan_latency_ms=round(latency_ms, 3),
            threats_detected=threats,
            sanitized_text=sanitized,
            raw_character_count=len(text),
            invisible_character_count=len(invisible_chars),
            shannon_entropy=entropy,
            steganography_decoded_payload=decoded_stego,
        )
