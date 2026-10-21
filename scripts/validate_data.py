"""Sanity-check data/raw/*.csv after a refresh, before it is committed.

Compares each CSV in the working tree with the version in git HEAD and fails when a refresh looks broken
(for example ESPN or ufc.com changed format and the scraper wrote nothing or lost columns).

    python -m scripts.validate_data
"""

from __future__ import annotations

import csv
import io
import re
import subprocess
import sys
import unicodedata
from collections import Counter
from datetime import date, datetime, timedelta
from pathlib import Path

RAW_DIR = Path("data") / "raw"
MAX_ROW_LOSS = 0.02  # tolerated shrink per file
# A finished card leaves upcoming_events.csv and is appended to event_cards.csv, so that file can shrink by one card.
ROW_LOSS = {"upcoming_events.csv": 0.40}
# Files the refresh rewrites; the others are maintained by hand or by other pipelines.
CHECKED = ["events.csv", "fights.csv", "event_cards.csv", "fighters.csv", "rankings.csv", "upcoming_events.csv", "fight_stats.csv"]
# fight_stats.csv has two rows (one per fighter) for every fight ESPN has numbers for, about 17,000 in all.
MIN_ROWS = {"rankings.csv": 100, "fights.csv": 8000, "fighters.csv": 4000, "events.csv": 700, "fight_stats.csv": 10000}
MAX_CONTRADICTORY_SHARE = 0.005  # share of fight_stats.csv rows that may have more landed than attempted (it is 0.11% today)
MAX_RANK = 15  # the UFC ranks 15 fighters per division (rank 0 is the champion)
STALE_UPCOMING_DAYS = 3  # a card this far past its date should have turned into results by now


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
        if old_n > 0 and new_n < old_n * (1 - ROW_LOSS.get(name, MAX_ROW_LOSS)):
            problems.append(f"{name}: rows dropped from {old_n} to {new_n}")
    return problems + structure_problems()


def warnings() -> list[str]:
    return (
        [f"champion mismatch: {note}" for note in champion_mismatches()]
        + [f"no fighter profile: {name}" for name in unmatched_names()]
        + [f"stale card: {note}" for note in stale_upcoming()]
    )


def read_dicts(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []
    with path.open(encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def name_key(value: str) -> str:
    ascii_text = unicodedata.normalize("NFKD", str(value or "")).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]", "", ascii_text.lower())


def rankings_structure_problems() -> list[str]:
    """Rows that would break the Rankings page: a repeated fighter, a rank outside 0-15, a P4P list with a champion.

    Two fighters may share a rank: the UFC publishes ties (for example two at #6, then #8)."""
    problems: list[str] = []
    by_category: dict[str, list[dict[str, str]]] = {}
    for row in read_dicts(RAW_DIR / "rankings.csv"):
        by_category.setdefault(row["category"], []).append(row)
    for category, rows in by_category.items():
        ranks = [row["rank"].strip() for row in rows]
        if any(not rank.isdigit() or int(rank) > MAX_RANK for rank in ranks):
            problems.append(f"rankings.csv: {category} has a rank outside 0-{MAX_RANK}")
        for fighter, count in Counter(name_key(row["fighter"]) for row in rows).items():
            if count > 1:
                problems.append(f"rankings.csv: {category} lists the same fighter twice ({fighter})")
        if rows[0]["is_p4p"].strip().lower() == "true" and "0" in ranks:
            problems.append(f"rankings.csv: {category} is pound-for-pound but has a champion row")
    return problems


def upcoming_structure_problems() -> list[str]:
    """Cards that would show a nonsense bout: a fighter against themself or booked twice on the same card."""
    problems: list[str] = []
    booked: dict[str, Counter] = {}
    for row in read_dicts(RAW_DIR / "upcoming_events.csv"):
        event, one, two = row["event_name"].strip(), row["fighter_1"].strip(), row["fighter_2"].strip()
        if not (one or two):
            continue  # an event with no bouts announced yet
        if not event:
            problems.append("upcoming_events.csv: a bout has no event name")
        if not (one and two):
            problems.append(f"upcoming_events.csv: {event}: a bout is missing a fighter")
            continue
        if name_key(one) == name_key(two):
            problems.append(f"upcoming_events.csv: {event}: {one} is booked against themself")
        booked.setdefault(event, Counter()).update({name_key(one): 1, name_key(two): 1})
    for event, counts in booked.items():
        problems.extend(
            f"upcoming_events.csv: {event}: a fighter is booked more than once ({key})" for key, n in counts.items() if n > 1
        )
    return problems


def fighter_record_problems() -> list[str]:
    bad = []
    for row in read_dicts(RAW_DIR / "fighters.csv"):
        for column in ("wins", "losses", "draws"):
            value = row.get(column, "").strip()
            if value and not value.isdigit():
                bad.append(f"{row.get('first_name', '')} {row.get('last_name', '')}".strip())
                break
    return [f"fighters.csv: {len(bad)} fighters have a non-numeric record (first: {bad[0]})"] if bad else []


def photo_manifest_problems() -> list[str]:
    """A photo the manifest lists must exist on disk, or the site would show a broken image for that fighter."""
    missing = [
        row["name"]
        for row in read_dicts(RAW_DIR / "fighter_photos.csv")
        if row.get("local_path", "").strip() and not Path(row["local_path"]).exists()
    ]
    return [f"fighter_photos.csv: {len(missing)} listed photos are missing on disk (first: {missing[0]})"] if missing else []


def fight_stats_problems() -> list[str]:
    """Per-fight statistics that would feed the model nonsense: a fight without both sides, more landed than attempted,
    a negative count, or a fight that is not in event_cards.csv."""
    rows = read_dicts(RAW_DIR / "fight_stats.csv")
    if not rows:
        return []
    known = {row["fight_url"] for row in read_dicts(RAW_DIR / "event_cards.csv")}
    sides: dict[str, list[str]] = {}
    for row in rows:
        sides.setdefault(row["fight_url"], []).append(name_key(row["fighter"]))
    problems = [f"fight_stats.csv: {url} has {len(who)} rows, not one per fighter" for url, who in sides.items() if len(who) != 2 or who[0] == who[1]]
    problems += [f"fight_stats.csv: {url} is not a fight in event_cards.csv" for url in sides if known and url not in known]
    contradictory = 0
    for row in rows:
        try:
            numbers = {k: float(v or 0) for k, v in row.items() if k not in {"fight_url", "event_date", "fighter", "opponent", "espn_event_id", "espn_competition_id", "espn_athlete_id"}}
        except ValueError:
            problems.append(f"fight_stats.csv: {row['fight_url']} has a number that is not a number")
            continue
        if any(v < 0 for v in numbers.values()):
            problems.append(f"fight_stats.csv: {row['fight_url']} ({row['fighter']}) has a negative number")
        contradictory += numbers.get("sig_landed", 0) > numbers.get("sig_attempted", 0) or numbers.get("td_landed", 0) > numbers.get("td_attempted", 0)
    # ESPN has a handful of fights with strikes landed but none attempted (the training code skips them). More than that
    # means the numbers changed meaning.
    if contradictory > max(MAX_CONTRADICTORY_SHARE * len(rows), 1):
        problems.append(f"fight_stats.csv: {contradictory} of {len(rows)} rows have more landed than attempted (the source has a few; this is too many)")
    return problems[:20]  # enough to see what is wrong


def structure_problems() -> list[str]:
    return rankings_structure_problems() + upcoming_structure_problems() + fighter_record_problems() + photo_manifest_problems() + fight_stats_problems()


def unmatched_names() -> list[str]:
    """Ranked fighters and upcoming-card fighters with no profile in fighters.csv (after name_aliases.csv). Warning only:
    the app still lists them, but their profile and prediction will not open."""
    known = {name_key(f"{row['first_name']} {row['last_name']}") for row in read_dicts(RAW_DIR / "fighters.csv")}
    if not known:
        return []
    aliases = {name_key(row["alias"]): name_key(row["canonical"]) for row in read_dicts(RAW_DIR / "name_aliases.csv")}
    wanted: dict[str, str] = {}
    for row in read_dicts(RAW_DIR / "rankings.csv"):
        wanted.setdefault(name_key(row["fighter"]), f"{row['fighter']} (ranked, {row['category']})")
    for row in read_dicts(RAW_DIR / "upcoming_events.csv"):
        for column in ("fighter_1", "fighter_2"):
            if row[column].strip():
                wanted.setdefault(name_key(row[column]), f"{row[column]} ({row['event_name']})")
    return [label for key, label in wanted.items() if key not in known and aliases.get(key) not in known]


def stale_upcoming(today: date | None = None) -> list[str]:
    """Upcoming cards whose date has passed: ESPN should have settled them into results by now."""
    cutoff = (today or date.today()) - timedelta(days=STALE_UPCOMING_DAYS)
    stale = set()
    for row in read_dicts(RAW_DIR / "upcoming_events.csv"):
        try:
            day = datetime.strptime(row["event_date"].strip(), "%B %d, %Y").date()
        except ValueError:
            continue
        if day < cutoff:
            stale.add(f"{row['event_name']} ({row['event_date']}) is still listed as upcoming")
    return sorted(stale)


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
    for note in warnings():
        # "::warning::" shows up as an annotation on the GitHub Actions run; elsewhere it is just a line of text.
        print(f"::warning::{note}")
    if problems:
        return 1
    print("[ok] data/raw looks consistent")
    return 0


if __name__ == "__main__":
    sys.exit(main())
