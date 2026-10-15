"""Sanity-check data/raw/*.csv after a refresh, before it is committed.

Compares each CSV in the working tree with the version in git HEAD and fails when a refresh looks broken
(for example ESPN or ufc.com changed format and the scraper wrote nothing or lost columns).

    python -m scripts.validate_data
"""

from __future__ import annotations

import csv
import io
import subprocess
import sys
from pathlib import Path

RAW_DIR = Path("data") / "raw"
MAX_ROW_LOSS = 0.02  # tolerated shrink per file
# Files the refresh rewrites; the others are maintained by hand or by other pipelines.
CHECKED = ["events.csv", "fights.csv", "event_cards.csv", "fighters.csv", "rankings.csv", "upcoming_events.csv"]
MIN_ROWS = {"rankings.csv": 100, "fights.csv": 8000, "fighters.csv": 4000, "events.csv": 700}


def read_rows(text: str) -> list[list[str]]:
    return list(csv.reader(io.StringIO(text)))


def committed_text(path: Path) -> str | None:
    result = subprocess.run(["git", "show", f"HEAD:{path.as_posix()}"], capture_output=True, text=True, encoding="utf-8")
    return result.stdout if result.returncode == 0 else None


def validate() -> list[str]:
    problems: list[str] = []
    for name in CHECKED:
        path = RAW_DIR / name
        if not path.exists():
            problems.append(f"{name}: file is missing")
            continue
        new_rows = read_rows(path.read_text(encoding="utf-8"))
        if len(new_rows) - 1 < MIN_ROWS.get(name, 1):
            problems.append(f"{name}: only {max(len(new_rows) - 1, 0)} rows (minimum {MIN_ROWS.get(name, 1)})")
        old_text = committed_text(path)
        if old_text is None:
            continue
        old_rows = read_rows(old_text)
        if old_rows and new_rows and old_rows[0] != new_rows[0]:
            problems.append(f"{name}: header changed {old_rows[0]} -> {new_rows[0]}")
        old_n, new_n = len(old_rows) - 1, len(new_rows) - 1
        if old_n > 0 and new_n < old_n * (1 - MAX_ROW_LOSS):
            problems.append(f"{name}: rows dropped from {old_n} to {new_n}")
    return problems


def champion_mismatches() -> list[str]:
    """Divisions where the official rankings and our hand-kept title_reigns.csv name different champions.

    Title changes are entered by hand, so after a title fight the rankings (refreshed daily) are the first to know. This
    only warns: the rankings can also be the one that is behind, and a vacant belt has no champion on either side."""
    rankings_path, reigns_path = RAW_DIR / "rankings.csv", RAW_DIR / "title_reigns.csv"
    if not rankings_path.exists() or not reigns_path.exists():
        return []
    with rankings_path.open(encoding="utf-8", newline="") as handle:
        ranked = {
            row["category"]: row["fighter"]
            for row in csv.DictReader(handle)
            if row["is_p4p"].strip().lower() != "true" and row["rank"].strip() == "0"
        }
    with reigns_path.open(encoding="utf-8", newline="") as handle:
        held = {
            row["division"]: row["champion"]
            for row in csv.DictReader(handle)
            if row["is_current"].strip().lower() == "true" and row["title_type"] == "undisputed"
        }

    def same(a: str, b: str) -> bool:
        return "".join(ch for ch in a.lower() if ch.isalnum()) == "".join(ch for ch in b.lower() if ch.isalnum())

    notes = []
    for division in sorted(set(ranked) | set(held)):
        official, ours = ranked.get(division), held.get(division)
        if official and ours and same(official, ours):
            continue
        if official or ours:
            notes.append(f"{division}: rankings say {official or 'nobody'}, title_reigns.csv says {ours or 'nobody'}")
    return notes


def main() -> int:
    problems = validate()
    for problem in problems:
        print(f"[invalid] {problem}")
    for note in champion_mismatches():
        # "::warning::" shows up as an annotation on the GitHub Actions run; elsewhere it is just a line of text.
        print(f"::warning::[champion mismatch] {note}")
    if problems:
        return 1
    print("[ok] data/raw looks consistent")
    return 0


if __name__ == "__main__":
    sys.exit(main())
