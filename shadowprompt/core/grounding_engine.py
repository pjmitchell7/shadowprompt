"""
GroundingEngine: Lexical containment and n-gram overlap research helper.
Overlap does not prove factual correctness or establish compliance.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import List, Set, Tuple

@dataclass
class GroundingResult:
    is_grounded: bool
    grounding_score: float
    circuit_breaker_tripped: bool
    matched_ngrams: int
    total_claim_ngrams: int
    unsupported_tokens: List[str]

class GroundingEngine:
    """
    Computes token and bigram overlap between context and claim text.
    """

    def __init__(self, threshold: float = 0.60):
        self.threshold = threshold

    def _tokenize(self, text: str) -> List[str]:
        return re.findall(r"\b[a-zA-Z0-9_-]+\b", text.lower())

    def _get_ngrams(self, tokens: List[str], n: int = 2) -> Set[Tuple[str, ...]]:
        if len(tokens) < n:
            return set()
        return {tuple(tokens[i : i + n]) for i in range(len(tokens) - n + 1)}

    def evaluate(self, retrieved_context: str, generated_claim: str) -> GroundingResult:
        ctx_tokens = self._tokenize(retrieved_context)
        claim_tokens = self._tokenize(generated_claim)

        if not claim_tokens:
            return GroundingResult(
                is_grounded=True,
                grounding_score=1.0,
                circuit_breaker_tripped=False,
                matched_ngrams=0,
                total_claim_ngrams=0,
                unsupported_tokens=[],
            )

        ctx_set = set(ctx_tokens)
        ctx_bigrams = self._get_ngrams(ctx_tokens, 2)
        claim_bigrams = self._get_ngrams(claim_tokens, 2)

        # 1. Token Containment
        unsupported = [t for t in claim_tokens if t not in ctx_set and not t.isdigit()]
        token_coverage = 1.0 - (len(unsupported) / max(len(claim_tokens), 1))

        # 2. Bigram Attribution
        if claim_bigrams:
            matched_bigrams = len(claim_bigrams.intersection(ctx_bigrams))
            bigram_score = matched_bigrams / len(claim_bigrams)
        else:
            matched_bigrams = 0
            bigram_score = token_coverage

        composite_score = round((0.4 * token_coverage) + (0.6 * bigram_score), 3)
        is_grounded = composite_score >= self.threshold

        return GroundingResult(
            is_grounded=is_grounded,
            grounding_score=composite_score,
            circuit_breaker_tripped=not is_grounded,
            matched_ngrams=matched_bigrams,
            total_claim_ngrams=len(claim_bigrams),
            unsupported_tokens=unsupported[:8],
        )
