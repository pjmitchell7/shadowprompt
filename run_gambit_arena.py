"""Run five local adversarial patch interaction examples."""
from dataclasses import asdict
import json
from shadowprompt.core.gambit_guard import GambitDefenseSimulator

if __name__ == "__main__":
    simulator = GambitDefenseSimulator()
    simulations = [
        simulator.run_assembly_trap_simulation,
        simulator.run_policy_poisoning_simulation,
        simulator.run_redos_goading_simulation,
        simulator.run_canonicalization_transmutation_simulation,
        simulator.run_canary_reflection_simulation,
    ]
    results = [asdict(simulate()) for simulate in simulations]
    print(json.dumps({
        "scope": "Five deterministic local examples; not general prevention guarantees",
        "sample_count": len(results),
        "mitigated": sum(result["is_mitigated"] for result in results),
        "results": results,
    }, indent=2))
