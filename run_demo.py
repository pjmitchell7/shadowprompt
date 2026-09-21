"""Run local fixture inspection or the Python tests."""
import argparse
from dataclasses import asdict
import json
import subprocess
import sys

from shadowprompt.fuzzer.red_team_suite import RedTeamSuite


def main():
    parser = argparse.ArgumentParser(description="ShadowPrompt local fixture benchmark")
    parser.add_argument("--cli", action="store_true", help="Run the fixture benchmark (default)")
    parser.add_argument("--test", action="store_true", help="Run all Python tests")
    parser.add_argument("--iterations", type=int, default=5, help="Fixture repetitions, 0 to 100")
    args = parser.parse_args()
    if args.test:
        return subprocess.call([sys.executable, "-m", "pytest", "-q"])
    try:
        report = RedTeamSuite().run_benchmark(iterations=args.iterations)
    except ValueError as error:
        parser.error(str(error))
    print(json.dumps(asdict(report), indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
