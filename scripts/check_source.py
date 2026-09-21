"""Reject emoji glyphs and em dashes in maintained authored text sources."""
from __future__ import annotations

import html
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
TEXT_SUFFIXES = {".py", ".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".html", ".css", ".md", ".json", ".yaml", ".yml", ".txt", ".toml", ".svg"}
EXCLUDED_PARTS = {"node_modules", "dist", ".git", ".venv", "venv", "__pycache__", ".pytest_cache", "test-results", "playwright-report"}
# Explicit ranges keep this check independent of third-party Unicode packages.
EMOJI = re.compile("[\U0001F000-\U0001FAFF\u2600-\u27BF\u2300-\u23FF\u2B00-\u2BFF\uFE0F\u20E3\u00A9\u00AE\u203C\u2049\u2122\u2139\u3030\u303D\u3297\u3299]")


def violations(text: str) -> list[tuple[int, str]]:
    findings = []
    for number, line in enumerate(text.splitlines(), 1):
        decoded = html.unescape(line)
        if "\u2014" in decoded:
            findings.append((number, "em dash (literal or HTML entity)"))
        if EMOJI.search(decoded):
            findings.append((number, "emoji or decorative symbol (use words or code geometry)"))
    return findings


def main() -> int:
    result = subprocess.run(
        ["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z"],
        cwd=ROOT, capture_output=True, check=True,
    )
    errors = []
    checked = 0
    for name in sorted(set(result.stdout.decode("utf-8").split("\0")) - {""}):
        path = ROOT / name
        if not path.is_file() or path.suffix not in TEXT_SUFFIXES:
            continue
        if EXCLUDED_PARTS.intersection(path.relative_to(ROOT).parts) or path.name == "package-lock.json":
            continue
        # Third-party license notices are retained verbatim, not authored copy.
        if "licenses" in path.relative_to(ROOT).parts:
            continue
        try:
            text = path.read_text(encoding="utf-8-sig")
        except UnicodeDecodeError:
            errors.append(f"{name}: not valid UTF-8 text")
            continue
        checked += 1
        errors.extend(f"{name}:{line}: {message}" for line, message in violations(text))
    if errors:
        print("\n".join(errors))
        return 1
    print(f"Source constraints passed for {checked} authored text files.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
