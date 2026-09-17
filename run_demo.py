"""
ShadowPrompt Master CLI & Demo Launcher.
Usage:
    python run_demo.py --cli    # Run interactive terminal threat fuzzer
    python run_demo.py --ui     # Launch Streamlit forensic dashboard
    python run_demo.py --test   # Run automated pytest verification
"""

import argparse
import os
from pathlib import Path
import subprocess
import sys
import time

if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

def run_cli_fuzzer():
    try:
        from rich.console import Console
        from rich.panel import Panel
        from rich.table import Table
        console = Console()
    except ImportError:
        console = None

    from shadowprompt.core.delimiter_guard import DelimiterGuard
    from shadowprompt.core.honeypot import HoneyPotSandbox
    from shadowprompt.core.tokenizer_scanner import TokenizerScanner
    from shadowprompt.fuzzer.attack_generator import AttackGenerator

    scanner = TokenizerScanner()
    guard = DelimiterGuard()
    honeypot = HoneyPotSandbox()
    fuzzer = AttackGenerator()

    if console:
        console.print(Panel.fit(
            "[bold red]ShadowPrompt Adversarial LLM Defense Suite[/bold red]\n"
            "[yellow]Sub-Millisecond Tokenizer Firewall & HoneyPot Deception[/yellow]",
            border_style="red"
        ))
    else:
        print("=== ShadowPrompt Adversarial LLM Defense Suite ===")

    vectors = fuzzer.get_test_suite()

    if console:
        table = Table(title="Live Adversarial Injection Test Results")
        table.add_column("Attack Vector", style="cyan")
        table.add_column("Category", style="magenta")
        table.add_column("Detection", style="bold")
        table.add_column("Latency (ms)", justify="right")
        table.add_column("Action Taken", style="green")

        for vec in vectors:
            t0 = time.perf_counter()
            s_res = scanner.scan(vec.raw_injected_payload)
            d_res = guard.inspect(vec.raw_injected_payload)
            lat = (time.perf_counter() - t0) * 1000.0

            is_malicious = vec.category != "BENIGN"
            intercepted = (not s_res.is_safe) or (len(d_res) > 0)

            status = "[red]BLOCKED ![/red]" if intercepted else "[green]PASSED [OK][/green]"
            action = "Engaged HoneyPot Sandbox" if intercepted else "Forwarded to LLM"

            table.add_row(vec.attack_name, vec.category, status, f"{lat:.3f}", action)

        console.print(table)
    else:
        for vec in vectors:
            t0 = time.perf_counter()
            s_res = scanner.scan(vec.raw_injected_payload)
            d_res = guard.inspect(vec.raw_injected_payload)
            lat = (time.perf_counter() - t0) * 1000.0
            intercepted = (not s_res.is_safe) or (len(d_res) > 0)
            status = "BLOCKED" if intercepted else "PASSED"
            print(f"[{status}] {vec.attack_name} ({vec.category}) - {lat:.3f}ms")

def run_ui():
    ui_script = Path(__file__).parent / "shadowprompt" / "ui" / "app.py"
    subprocess.run([sys.executable, "-m", "streamlit", "run", str(ui_script)])

def run_tests():
    subprocess.run([sys.executable, "-m", "pytest", "tests/test_shadowprompt.py", "-v"])

def main():
    parser = argparse.ArgumentParser(description="ShadowPrompt Runner")
    parser.add_argument("--cli", action="store_true", help="Run interactive terminal threat fuzzer")
    parser.add_argument("--ui", action="store_true", help="Launch Streamlit forensic dashboard")
    parser.add_argument("--test", action="store_true", help="Run pytest suite")

    args = parser.parse_args()
    if args.ui:
        run_ui()
    elif args.test:
        run_tests()
    else:
        run_cli_fuzzer()

if __name__ == "__main__":
    main()
