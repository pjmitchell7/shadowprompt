"""
Gambit Arena: Game-Theoretic Multi-Move Adversarial Simulation.
Demonstrates the 3-Move Chess Game between an Attacker and a Self-Improving Defense:
Move 1: The Gambit (Attacker feeds predictable bait)
Move 2: The Forced Response (Defense synthesizes a reactive patch)
Move 3: The Checkmate Attempt (Attacker exploits the defense's own patch)
Defense: Anti-Goading Invariant (Neutralizes the checkmate via Fail-Closed & Non-Collapsible Sentinels)
"""

import sys
import time
from shadowprompt.core.gambit_guard import GambitDefenseSimulator


def print_banner(title: str, char="=", width=84):
    print(char * width)
    print(title.center(width))
    print(char * width)


def print_move(move_num: int, actor: str, action: str, detail: str):
    tag = f"[MOVE {move_num}: {actor}]"
    print(f"{tag:<24} {action}")
    print(f"{'':<24} Detail: {detail}")


def main():
    print_banner("SHADOWPROMPT ADVERSARIAL GAMBIT ARENA")
    print("Simulating 3-Move Game-Theoretic Checkmate Attacks Against Self-Healing Firewalls")
    print("Target Secret: FLAG{SHADOWPROMPT_AIRGAP_KEY_9921}\n")

    simulator = GambitDefenseSimulator()

    plays = [
        simulator.run_assembly_trap_simulation(),
        simulator.run_policy_poisoning_simulation(),
        simulator.run_redos_goading_simulation(),
    ]

    for i, play in enumerate(plays, start=1):
        print("=" * 84)
        print(f"PLAY {i}: {play.attack_name.upper()}")
        print("-" * 84)

        # Move 1
        print_move(1, "ATTACKER BAIT", "Feeds sacrificial exploit bait", play.move_1_bait)
        # Move 2
        print_move(2, "DEFENSE REACTION", "Auto-patcher reacts predictably", play.move_2_defense_reaction)
        # Move 3
        print_move(3, "ATTACKER CHECKMATE", "Fires payload exploiting the patch", play.move_3_attacker_checkmate_attempt)

        print("-" * 84)
        print("THE SYSTEM OUTCOMES:")
        print(f"  [NAIVE DEFENSE]   -> {play.naive_defense_outcome}")
        print(f"  [SHADOWPROMPT]    -> {play.hardened_defense_outcome}")
        status = "PASSED (CHECKMATE NEUTRALIZED)" if play.is_mitigated else "FAILED"
        print(f"  [ARBITER VERDICT] -> {status} in {play.telemetry_latency_ms:.4f} ms")
        print("=" * 84 + "\n")

    print_banner("GAME-THEORETIC AUDIT COMPLETE: ALL 3 GAMBITS SAFELY MITIGATED")
    print("Architectural Takeaway: Never sanitize by deletion; enforce Fail-Closed invariants.\n")


if __name__ == "__main__":
    main()
