"""
ShadowPrompt: Local prompt inspection and adversarial research fixtures
"""

__version__ = "2.0.0"
__author__ = "Paul (Mitch) Mitchell"

from shadowprompt.core.proxy import PreInferenceProxy
from shadowprompt.core.tokenizer_scanner import TokenizerScanner, ScanResult
from shadowprompt.core.delimiter_guard import DelimiterGuard
from shadowprompt.core.grounding_engine import GroundingEngine
from shadowprompt.core.honeypot import HoneyPotSandbox
from shadowprompt.fuzzer.attack_generator import AttackGenerator
from shadowprompt.fuzzer.red_team_suite import RedTeamSuite

__all__ = [
    "PreInferenceProxy",
    "TokenizerScanner",
    "ScanResult",
    "DelimiterGuard",
    "GroundingEngine",
    "HoneyPotSandbox",
    "AttackGenerator",
    "RedTeamSuite",
]
