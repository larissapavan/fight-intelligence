"""Check and update title fights and champion reigns in data/raw/title_reigns.csv.

Detects title defenses and title changes from event_cards.csv and fight_details.csv,
and updates title_reigns.csv automatically:
- Title defense (champion wins): increments defenses_count and appends to defenses_detail.
- Title change (challenger wins): marks old reign ended (is_current=False, lost_title_fight,
  calculates days_held) and inserts a new reign row for the new champion.

Usage:
    python -m scripts.check_title_fights            # Preview / dry-run
    python -m scripts.check_title_fights --apply    # Apply updates to title_reigns.csv
"""

from __future__ import annotations

import argparse
import csv
import sys
import unicodedata
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Any

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.ufc_predictor.config import RAW_DATA_DIR

REIGNS_PATH = RAW_DATA_DIR / "title_reigns.csv"
CARDS_PATH = RAW_DATA_DIR / "event_cards.csv"
DETAILS_PATH = RAW_DATA_DIR / "fight_details.csv"
FIGHTERS_PATH = RAW_DATA_DIR / "fighters.csv"

REIGNS_FIELDNAMES = [
    "division",
    "reign_order",
    "reign_no_label",
    "title_type",
    "champion",
    "fighter_url",
    "fighter_reign_index",
    "won_how",
    "opponent_beaten",
    "event",
    "location",
    "date_won",
    "date_won_raw",
    "days_held",
    "is_current",
    "defenses_count",
    "defenses_detail",
    "end_reason",
]


def normalize_name(name: str) -> str:
    """ASCII alphanumeric lowercase name key for robust matching across accents and spacing."""
    if not name:
        return ""
    decomposed = unicodedata.normalize("NFKD", name)
    ascii_text = decomposed.encode("ascii", "ignore").decode("ascii")
    return "".join(c for c in ascii_text.lower() if c.isalnum())


def normalize_division(div: str) -> str:
    """Normalize division names to match title_reigns.csv categories."""
    d = div.strip()
    if d.lower().startswith("women"):
        if not d.lower().startswith("women's"):
            d = "Women's " + d[5:].strip()
    return d


def format_raw_date(d: date) -> str:
    """Format date as 'Mon DD, YYYY' without leading zero on day (e.g. 'Oct 24, 2026')."""
    return d.strftime("%b %d, %Y").replace(" 0", " ")


def parse_date(date_str: str) -> date | None:
    """Parse date from various formats found in raw files."""
    if not date_str:
        return None
    cleaned = date_str.strip().strip('"')
    for fmt in ("%Y-%m-%d", "%B %d, %Y", "%b %d, %Y"):
        try:
            return datetime.strptime(cleaned, fmt).date()
        except ValueError:
            continue
    return None


def short_event_name(event_name: str) -> str:
    """Shorten event name e.g. 'UFC 333: Volkanovski vs. Evloev' -> 'UFC 333'."""
    name = event_name.strip()
    if ":" in name:
        prefix = name.split(":", 1)[0].strip()
        if prefix.lower().startswith("ufc"):
            return prefix
    return name


def load_fighter_urls(fighters_path: Path) -> dict[str, str]:
    urls: dict[str, str] = {}
    if not fighters_path.exists():
        return urls
    with fighters_path.open(encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            first = row.get("first_name", "").strip()
            last = row.get("last_name", "").strip()
            full = f"{first} {last}".strip()
            url = row.get("fighter_url", "").strip()
            if full and url:
                urls[normalize_name(full)] = url
    return urls


def load_fight_details_title_flags(details_path: Path) -> dict[str, bool]:
    flags: dict[str, bool] = {}
    if not details_path.exists():
        return flags
    with details_path.open(encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            url = row.get("fight_url", "").strip()
            is_title = row.get("title_fight", "").strip().lower() == "true"
            if url:
                flags[url] = is_title
    return flags


def check_and_update_title_fights(
    reigns_path: Path = REIGNS_PATH,
    cards_path: Path = CARDS_PATH,
    details_path: Path = DETAILS_PATH,
    fighters_path: Path = FIGHTERS_PATH,
    apply: bool = False,
) -> tuple[list[dict[str, Any]], list[str]]:
    """Scan event_cards for title fights involving current champions and compute updates."""
    if not reigns_path.exists():
        return [], [f"Reigns file not found: {reigns_path}"]
    if not cards_path.exists():
        return [], [f"Cards file not found: {cards_path}"]

    with reigns_path.open(encoding="utf-8", newline="") as f:
        reigns = list(csv.DictReader(f))

    with cards_path.open(encoding="utf-8", newline="") as f:
        cards = list(csv.DictReader(f))

    fighter_urls = load_fighter_urls(fighters_path)
    title_flags = load_fight_details_title_flags(details_path)

    # Sort fights chronologically so that consecutive title events resolve in order
    def fight_sort_key(row: dict[str, str]) -> tuple[date, str]:
        d = parse_date(row.get("event_date", "")) or date.min
        return (d, row.get("fight_url", ""))

    cards_sorted = sorted(cards, key=fight_sort_key)

    logs: list[str] = []
    modified = False

    for fight in cards_sorted:
        winner = fight.get("winner", "").strip()
        f1 = fight.get("fighter_1", "").strip()
        f2 = fight.get("fighter_2", "").strip()
        if not winner or not f1 or not f2:
            continue

        fight_url = fight.get("fight_url", "").strip()
        fight_date = parse_date(fight.get("event_date", ""))
        if not fight_date:
            continue

        weight_class = normalize_division(fight.get("weight_class", ""))
        event_name = fight.get("event_name", "").strip()
        short_event = short_event_name(event_name)
        location = fight.get("location", "").strip()

        # Find any current champion involved in this fight
        for idx, reign in enumerate(reigns):
            if reign.get("is_current", "").strip().lower() != "true":
                continue

            champ_name = reign.get("champion", "").strip()
            champ_key = normalize_name(champ_name)
            champ_div = normalize_division(reign.get("division", ""))

            is_f1 = normalize_name(f1) == champ_key
            is_f2 = normalize_name(f2) == champ_key
            if not (is_f1 or is_f2):
                continue

            # Check if this fight was in champion's division (or flagged title fight)
            explicit_title = title_flags.get(fight_url, False)
            div_match = normalize_name(weight_class) == normalize_name(champ_div)
            if not (div_match or explicit_title):
                continue

            reign_date_won = parse_date(reign.get("date_won", ""))
            if reign_date_won and fight_date <= reign_date_won:
                # Occurred on or before the day this championship reign began (the winning fight)
                continue

            opponent = f2 if is_f1 else f1
            opponent_key = normalize_name(opponent)
            winner_key = normalize_name(winner)

            if winner_key == champ_key:
                # Champion defended title
                existing_defenses = reign.get("defenses_detail", "").strip()
                defense_token = f"def. {opponent} at {short_event}"
                if defense_token in existing_defenses or (opponent in existing_defenses and short_event in existing_defenses):
                    # Defense already recorded
                    continue

                raw_date = format_raw_date(fight_date)
                new_defense_entry = f"def. {opponent} at {short_event} on {raw_date}"
                if existing_defenses:
                    updated_defenses = f"{existing_defenses} ; {new_defense_entry}"
                else:
                    updated_defenses = new_defense_entry

                try:
                    current_count = int(reign.get("defenses_count", "0") or "0")
                except ValueError:
                    current_count = 0

                reign["defenses_count"] = str(current_count + 1)
                reign["defenses_detail"] = updated_defenses
                modified = True
                logs.append(
                    f"[defense] {champ_name} defended {champ_div} title vs {opponent} at {short_event} ({raw_date})"
                )

            elif winner_key == opponent_key:
                # Title change: challenger won
                days_held = (fight_date - reign_date_won).days if reign_date_won else ""
                reign["is_current"] = "False"
                reign["end_reason"] = "lost_title_fight"
                reign["days_held"] = str(days_held)

                # Determine reign_order and labels for the new champion
                div_reigns = [r for r in reigns if normalize_division(r.get("division", "")) == champ_div]
                try:
                    max_order = max(int(r.get("reign_order", 0) or 0) for r in div_reigns)
                except ValueError:
                    max_order = len(div_reigns)
                new_order = max_order + 1

                # Previous undisputed label
                undisputed_labels = [
                    int(r.get("reign_no_label", 0))
                    for r in div_reigns
                    if r.get("title_type") == "undisputed" and (r.get("reign_no_label") or "").isdigit()
                ]
                new_label = str(max(undisputed_labels) + 1 if undisputed_labels else 1)

                # Fighter's personal reign index in this division
                past_personal_reigns = sum(
                    1 for r in div_reigns if normalize_name(r.get("champion", "")) == opponent_key
                )
                fighter_reign_index = str(past_personal_reigns + 1)

                challenger_url = fighter_urls.get(opponent_key, "")
                raw_date = format_raw_date(fight_date)

                new_reign = {
                    "division": champ_div,
                    "reign_order": str(new_order),
                    "reign_no_label": new_label,
                    "title_type": "undisputed",
                    "champion": opponent,
                    "fighter_url": challenger_url,
                    "fighter_reign_index": fighter_reign_index,
                    "won_how": f"def. {champ_name}",
                    "opponent_beaten": champ_name,
                    "event": short_event,
                    "location": location,
                    "date_won": fight_date.strftime("%Y-%m-%d"),
                    "date_won_raw": raw_date,
                    "days_held": "",
                    "is_current": "True",
                    "defenses_count": "0",
                    "defenses_detail": "",
                    "end_reason": "current",
                }
                reigns.append(new_reign)
                modified = True
                logs.append(
                    f"[title change] {opponent} defeated {champ_name} for the {champ_div} championship at {short_event} ({raw_date})"
                )

    if modified and apply:
        with reigns_path.open("w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=REIGNS_FIELDNAMES)
            writer.writeheader()
            writer.writerows(reigns)
        logs.append(f"[saved] Updated {reigns_path}")
    elif modified and not apply:
        logs.append("[dry-run] Changes detected. Run with --apply to save.")
    else:
        logs.append("[up to date] No new title fights detected.")

    return reigns, logs


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Write updates directly to data/raw/title_reigns.csv (default is dry-run)",
    )
    args = parser.parse_args(argv)

    _, logs = check_and_update_title_fights(apply=args.apply)
    for log in logs:
        print(log)
    return 0


if __name__ == "__main__":
    sys.exit(main())
