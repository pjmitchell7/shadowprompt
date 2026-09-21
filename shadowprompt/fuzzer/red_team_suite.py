"""Fixture benchmark of the actual inspection pipeline, with measured counts."""
from __future__ import annotations

import math
import statistics
import time
from dataclasses import dataclass
from typing import Optional

from shadowprompt.core.proxy import PreInferenceProxy
from shadowprompt.fuzzer.attack_generator import AttackGenerator


@dataclass
class BenchmarkReport:
    total_vectors_tested: int
    attacks_blocked: int
    benign_passed: int
    true_positives: int
    false_positives: int
    true_negatives: int
    false_negatives: int
    recall_rate: Optional[float]
    precision_rate: Optional[float]
    f1_score: Optional[float]
    avg_latency_ms: Optional[float]
    p95_latency_ms: Optional[float]
    p99_latency_ms: Optional[float]
    scope: str = "Repeated local fixtures; rule matches, not observed model compromises"
    timing_scope: str = "Python inspect_stream only; nearest-rank percentiles; no network or model inference"


class RedTeamSuite:
    def __init__(self):
        self.proxy = PreInferenceProxy(enable_honeypot=False)
        self.generator = AttackGenerator()

    def run_benchmark(self, iterations: int = 5) -> BenchmarkReport:
        if not isinstance(iterations, int) or isinstance(iterations, bool) or not 0 <= iterations <= 100:
            raise ValueError("iterations must be an integer from 0 to 100")
        samples = self.generator.get_test_suite() * iterations
        tp = fp = tn = fn = 0
        latencies = []
        for sample in samples:
            start = time.perf_counter()
            _, findings = self.proxy.inspect_stream(sample.raw_injected_payload)
            latencies.append((time.perf_counter() - start) * 1000)
            flagged = bool(findings)
            malicious = sample.category != "BENIGN"
            tp += malicious and flagged
            fn += malicious and not flagged
            tn += not malicious and not flagged
            fp += not malicious and flagged
        recall = tp / (tp + fn) if tp + fn else None
        precision = tp / (tp + fp) if tp + fp else None
        f1 = 2 * tp / (2 * tp + fp + fn) if 2 * tp + fp + fn else None
        latencies.sort()

        def percentile(fraction):
            return latencies[math.ceil(len(latencies) * fraction) - 1] if latencies else None

        return BenchmarkReport(
            total_vectors_tested=len(samples), attacks_blocked=tp, benign_passed=tn,
            true_positives=tp, false_positives=fp, true_negatives=tn, false_negatives=fn,
            recall_rate=recall * 100 if recall is not None else None,
            precision_rate=precision * 100 if precision is not None else None,
            f1_score=f1, avg_latency_ms=statistics.mean(latencies) if latencies else None,
            p95_latency_ms=percentile(.95), p99_latency_ms=percentile(.99),
        )
