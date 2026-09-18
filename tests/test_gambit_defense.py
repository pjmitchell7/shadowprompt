"""
Pytest suite for GambitGuard and Anti-Goading Invariants.
Validates the defense against:
1. Assembly Trap (Sanitization-Induced Weaponization)
2. Policy Poisoning (Denial of Service via broad vocabulary matches)
3. ReDoS Algorithmic Backtracking
"""

import pytest
import re
from shadowprompt.core.gambit_guard import AntiGoadingValidator, GambitDefenseSimulator


def test_assembly_trap_mitigation():
    sim = GambitDefenseSimulator()
    result = sim.run_assembly_trap_simulation()

    assert result.is_mitigated is True
    assert "[BLOCKED_TOKEN]" in result.hardened_defense_outcome
    assert "VULNERABLE" in result.naive_defense_outcome
    assert result.telemetry_latency_ms < 1.0


def test_policy_poisoning_rejection():
    sim = GambitDefenseSimulator()
    result = sim.run_policy_poisoning_simulation()

    # The sandbox must reject the overfitted rule
    assert result.is_mitigated is True
    assert "Sandbox rejected candidate patch" in result.hardened_defense_outcome
    assert result.telemetry_latency_ms < 1.0


def test_redos_backtracking_detection():
    validator = AntiGoadingValidator()
    # Malicious backtracking regex
    bad_regex = re.compile(r"(a+)+$")
    # Linear safe regex
    safe_regex = re.compile(r"^a+$")

    is_safe_linear, _ = validator.audit_redos_backtracking(safe_regex)
    is_bad_linear, _ = validator.audit_redos_backtracking(bad_regex)

    assert is_safe_linear is True
    # The bad regex should take significantly longer or fail the threshold
    sim_redos = GambitDefenseSimulator().run_redos_goading_simulation()
    assert sim_redos.is_mitigated is True


def test_canonicalization_transmutation():
    sim = GambitDefenseSimulator()
    result = sim.run_canonicalization_transmutation_simulation()

    assert result.is_mitigated is True
    assert "CANONICALIZATION_TRANSMUTATION" in result.hardened_defense_outcome
    assert "VULNERABLE" in result.naive_defense_outcome


def test_canary_reflection_mitigation():
    sim = GambitDefenseSimulator()
    result = sim.run_canary_reflection_simulation()

    assert result.is_mitigated is True
    assert "Honeypot ledger detected active canary reflection" in result.hardened_defense_outcome
    assert "VULNERABLE" in result.naive_defense_outcome
    assert result.telemetry_latency_ms < 1.0
