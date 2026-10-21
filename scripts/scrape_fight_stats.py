"""Per-fight statistics (strikes, takedowns, control time ...) from ESPN's public JSON API.

The UFC Stats pages that carry these numbers sit behind a browser check, but ESPN publishes the same per-fight totals
for every fighter in every fight from 2005 on. They are what lets a model know a fighter's striking and takedown
accuracy *as it stood before a fight*, instead of the career totals of today (which include that fight and every later
one).

data/raw/fight_stats.csv has one row per fighter per fight, keyed by the fight_url of data/raw/event_cards.csv. The
fighter names are the ones in event_cards.csv, so no name matching is needed downstream. Fights ESPN does not list, or
lists without numbers, are recorded in data/raw/fight_stats_unmatched.csv so they are not asked again.

The run is resumable: events already collected are skipped. A full history is about 18,000 requests at 0.3 s each.

Usage (from the repo root):
    python -m scripts.scrape_fight_stats --dry-run --limit-events 3     # what it would fetch, nothing written
    python -m scripts.scrape_fight_stats                                # everything not collected yet
    python -m scripts.scrape_fight_stats --since 2026-01-01             # only recent events (the daily update)
"""

from __future__ import annotations

import argparse
import csv
import sys
import time
from datetime import date, datetime, timedelta
from pathlib import Path

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from scripts.scrape_espn import CORE_URL, REQUEST_DELAY_SECONDS, EspnClient, EspnEvent, _ratio, same_pair

RAW_DIR = Path("data") / "raw"
CARDS_PATH = RAW_DIR / "event_cards.csv"
STATS_PATH = RAW_DIR / "fight_stats.csv"
UNMATCHED_PATH = RAW_DIR / "fight_stats_unmatched.csv"

# ESPN's name for a number -> our column. Landed/attempted pairs are kept separate so any accuracy can be built.
STAT_COLUMNS = {
    "knockDowns": "knockdowns",
    "sigStrikesLanded": "sig_landed",
    "sigStrikesAttempted": "sig_attempted",
    "totalStrikesLanded": "total_landed",
    "totalStrikesAttempted": "total_attempted",
    "takedownsLanded": "td_landed",
    "takedownsAttempted": "td_attempted",
    "submissions": "submission_attempts",
    "reversals": "reversals",
    "advances": "advances",
    "timeInControl": "control_seconds",
}
FIELDS = ["fight_url", "event_date", "fighter", "opponent", "espn_event_id", "espn_competition_id", "espn_athlete_id", *STAT_COLUMNS.values()]
UNMATCHED_FIELDS = ["fight_url", "event_date", "fighter_1", "fighter_2", "reason"]


def parse_statistics(payload: dict) -> dict[str, float] | None:
    """Our columns from one competitor's statistics payload, or None when ESPN has no numbers for the fight."""
    categories = (payload.get("splits") or {}).get("categories") if isinstance(payload, dict) else None
    values = {stat.get("name"): stat.get("value") for category in categories or [] for stat in category.get("stats", [])}
    if not any(values.get(name) for name in STAT_COLUMNS):
        return None
    return {column: float(values.get(name) or 0.0) for name, column in STAT_COLUMNS.items()}


def load_rows(path: Path) -> list[dict]:
    if not path.exists():
        return []
    with path.open(encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def append_rows(path: Path, fields: list[str], rows: list[dict]) -> None:
    if not rows:
        return
    new_file = not path.exists()
    with path.open("a", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, lineterminator="\n")
        if new_file:
            writer.writeheader()
        writer.writerows(rows)


def pending_fights(cards: list[dict], done: set[str], since: date | None, until: date | None) -> dict[date, list[dict]]:
    """Past fights still without statistics, grouped by event day."""
    by_day: dict[date, list[dict]] = {}
    for row in cards:
        if not row["fight_url"] or row["fight_url"] in done:
            continue
        try:
            day = datetime.strptime(row["event_date"], "%B %d, %Y").date()
        except ValueError:
            continue
        if (since and day < since) or (until and day > until) or day >= date.today():
            continue
        by_day.setdefault(day, []).append(row)
    return dict(sorted(by_day.items()))


class StatsCollector:
    def __init__(self, client: EspnClient, delay: float = REQUEST_DELAY_SECONDS) -> None:
        self.client = client
        self.delay = delay
        self._months: dict[tuple[int, int], list[EspnEvent]] = {}

    def events_around(self, day: date) -> list[EspnEvent]:
        """ESPN's events for the month of `day` (one scoreboard call per month, shared by every event in it)."""
        key = (day.year, day.month)
        if key not in self._months:
            first = date(day.year, day.month, 1) - timedelta(days=1)
            last = (date(day.year + day.month // 12, day.month % 12 + 1, 1)) + timedelta(days=1)
            time.sleep(self.delay)
            self._months[key] = self.client.scoreboard(first, last)
        return self._months[key]

    def fetch_competitor(self, event: EspnEvent, competition_id: str, athlete_id: str) -> dict[str, float] | None:
        time.sleep(self.delay)
        url = f"{CORE_URL}/events/{event.espn_id}/competitions/{competition_id}/competitors/{athlete_id}/statistics?lang=en"
        try:
            return parse_statistics(self.client.get_json(url))
        except RuntimeError:
            return None

    def collect_day(self, day: date, fights: list[dict]) -> tuple[list[dict], list[dict]]:
        """(stat rows, unmatched rows) for every fight of one event day."""
        events = self.events_around(day)
        rows: list[dict] = []
        unmatched: list[dict] = []
        for fight in fights:
            found = self._find_bout(events, fight)
            if found is None:
                unmatched.append(self._unmatched(fight, "not on ESPN's scoreboard"))
                continue
            event, bout = found
            first, second = self._assign(fight, bout)
            stats = [self.fetch_competitor(event, bout.competition_id, who.espn_id) for who in (first, second)]
            if stats[0] is None or stats[1] is None:
                unmatched.append(self._unmatched(fight, "ESPN has no numbers for it"))
                continue
            for espn_fighter, own, other, numbers in (
                (first, fight["fighter_1"], fight["fighter_2"], stats[0]),
                (second, fight["fighter_2"], fight["fighter_1"], stats[1]),
            ):
                rows.append(
                    {
                        "fight_url": fight["fight_url"], "event_date": fight["event_date"], "fighter": own, "opponent": other,
                        "espn_event_id": event.espn_id, "espn_competition_id": bout.competition_id,
                        "espn_athlete_id": espn_fighter.espn_id, **{k: f"{v:g}" for k, v in numbers.items()},
                    }
                )
        return rows, unmatched

    @staticmethod
    def _find_bout(events: list[EspnEvent], fight: dict):
        for event in events:
            for bout in event.bouts:
                if bout.completed and len(bout.fighters) == 2 and bout.competition_id and same_pair(
                    fight["fighter_1"], fight["fighter_2"], bout.fighters[0].name, bout.fighters[1].name
                ):
                    return event, bout
        return None

    @staticmethod
    def _assign(fight: dict, bout):
        """The ESPN fighters in the order of our fighter_1, fighter_2."""
        a, b = bout.fighters
        straight = _ratio(fight["fighter_1"], a.name) + _ratio(fight["fighter_2"], b.name)
        crossed = _ratio(fight["fighter_1"], b.name) + _ratio(fight["fighter_2"], a.name)
        return (a, b) if straight >= crossed else (b, a)

    @staticmethod
    def _unmatched(fight: dict, reason: str) -> dict:
        return {"fight_url": fight["fight_url"], "event_date": fight["event_date"], "fighter_1": fight["fighter_1"], "fighter_2": fight["fighter_2"], "reason": reason}


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--since", help="first event day to collect, YYYY-MM-DD")
    parser.add_argument("--until", help="last event day to collect, YYYY-MM-DD")
    parser.add_argument("--limit-events", type=int, help="stop after this many event days")
    parser.add_argument("--delay", type=float, default=REQUEST_DELAY_SECONDS, help="seconds between ESPN requests")
    parser.add_argument("--retry-unmatched", action="store_true", help="ask again about fights ESPN had no numbers for")
    parser.add_argument("--dry-run", action="store_true", help="list what would be fetched; write nothing")
    parser.add_argument("--output", type=Path, default=STATS_PATH, help="where to append the statistics (for runs split by date range)")
    parser.add_argument("--unmatched-output", type=Path, default=UNMATCHED_PATH)
    args = parser.parse_args(argv)

    cards = load_rows(CARDS_PATH)
    # Fights already in the main file count as done even when this run writes to a side file.
    done = {row["fight_url"] for path in {STATS_PATH, args.output} for row in load_rows(path)}
    if not args.retry_unmatched:
        done |= {row["fight_url"] for path in {UNMATCHED_PATH, args.unmatched_output} for row in load_rows(path)}
    since = date.fromisoformat(args.since) if args.since else None
    until = date.fromisoformat(args.until) if args.until else None
    days = pending_fights(cards, done, since, until)
    if args.limit_events:
        days = dict(list(days.items())[: args.limit_events])
    total = sum(len(v) for v in days.values())
    print(f"[info] {total} fights on {len(days)} event days still need statistics")
    if args.dry_run or not days:
        return

    collector = StatsCollector(EspnClient(), args.delay)
    collected = missed = 0
    for index, (day, fights) in enumerate(days.items(), 1):
        rows, unmatched = collector.collect_day(day, fights)
        append_rows(args.output, FIELDS, rows)
        append_rows(args.unmatched_output, UNMATCHED_FIELDS, unmatched)
        collected += len(rows) // 2
        missed += len(unmatched)
        if index % 25 == 0 or index == len(days):
            print(f"  [{index}/{len(days)}] {day}: {collected} fights collected, {missed} without numbers")
    print(f"[info] fight statistics: {collected} fights collected, {missed} without numbers")


if __name__ == "__main__":
    main()
