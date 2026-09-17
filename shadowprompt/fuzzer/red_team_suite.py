"""
RedTeamSuite: Automated benchmark and scoring harness.
Evaluates detection recall, false-positive rate, latency distribution (P95, P99),
and maps compliance to NIST AI 100-2 / SP 800-218A.
"""

from __future__ import annotations

import statistics
import time
from dataclasses import dataclass
from typing import Dict, List

from shadowprompt.core.delimiter_guard import DelimiterGuard
from shadowprompt.core.tokenizer_scanner import TokenizerScanner
from shadowprompt.fuzzer.attack_generator import AttackGenerator, AttackVector

@dataclass
class BenchmarkReport:
    total_vectors_tested: int
    attacks_blocked: int
    benign_passed: int
    false_positives: int
    false_negatives: int
    recall_rate: float
    precision_rate: float
    f1_score: float
    avg_latency_ms: float
    p95_latency_ms: float
    p99_latency_ms: float
    nist_compliance_score: float

class RedTeamSuite:
    """Benchmark runner for ShadowPrompt."""

    def __init__(self):
        self.scanner = TokenizerScanner()
        self.delimiter_guard = DelimiterGuard()
        self.generator = AttackGenerator()

    def run_benchmark(self, iterations: int = 5) -> BenchmarkReport:
        vectors = self.generator.get_test_suite()
        all_samples: List[AttackVector] = vectors * iterations

        tp = 0  # True positive
        fp = 0  # False positive
        tn = 0  # True negative
        fn = 0  # False negative
        latencies: List[float] = []

        for sample in all_samples:
            t0 = time.perf_counter()
            s_res = self.scanner.scan(sample.raw_injected_payload)
            d_res = self.delimiter_guard.inspect(sample.raw_injected_payload)
            lat = (time.perf_counter() - t0) * 1000.0
            latencies.append(lat)

            is_flagged = (not s_res.is_safe) or (len(d_res) > 0)
            is_malicious = sample.category != "BENIGN"

            if is_malicious and is_flagged:
                tp += 1
            elif is_malicious and not is_flagged:
                fn += 1
            elif not is_malicious and not is_flagged:
                tn += 1
            elif not is_malicious and is_flagged:
                fp += 1

        total_malicious = tp + fn
        total_benign = tn + fp

        recall = tp / total_malicious if total_malicious > 0 else 1.0
        precision = tp / (tp + fp) if (tp + fp) > 0 else 1.0
        f1 = (2 * precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0

        latencies.sort()
        avg_lat = statistics.mean(latencies)
        p95 = latencies[int(len(latencies) * 0.95)]
        p99 = latencies[int(len(latencies) * 0.99)]

        # NIST compliance composite: weighted by recall, latency (<2ms), and zero FP
        nist_score = round((recall * 0.5 + precision * 0.3 + (1.0 if p99 < 2.0 else 0.5) * 0.2) * 100.0, 1)

        return BenchmarkReport(
            total_vectors_tested=len(all_samples),
            attacks_blocked=tp,
            benign_passed=tn,
            false_positives=fp,
            false_negatives=fn,
            recall_rate=round(recall * 100.0, 1),
            precision_rate=round(precision * 100.0, 1),
            f1_score=round(f1, 3),
            avg_latency_ms=round(avg_lat, 3),
            p95_latency_ms=round(p95, 3),
            p99_latency_ms=round(p99, 3),
            nist_compliance_score=nist_score,
        )
