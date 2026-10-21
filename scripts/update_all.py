"""Run the whole data refresh in one command.

Order matters: results and new fighters first, then the rankings, then photos (champions come from the same
ufc.com page as the rankings, and fighters created from ESPN need their headshot checked).

    0. Predict   scripts.log_predictions             log the model's pick for every announced fight (before ESPN turns cards into results)
    1. ESPN      scripts.scrape_espn                 events, results, upcoming cards, records, debut fighters
       Stats     scripts.scrape_fight_stats          strikes, takedowns and control time of the fights that just happened (ESPN)
    2. Rankings  scripts.scrape_rankings             official UFC divisional + P4P rankings (ufc.com)
    3. Photos    scripts.download_fighter_photos     current champion belt photos + headshots for fighters without one
    4. Origins   scripts.scrape_fighter_origins      hometown and the country each fighter represents (flag), for new fighters
    5. Roster    scripts.scrape_roster_watch         the UFC roster (roster.watch): status, nationalities, badges, debut and last fight dates
    6. Records   scripts.scrape_stat_leaders         the UFC's career Record Book (statleaders.ufc.com)
    7. PFL       scripts.scrape_pfl                  the Professional Fighters League: events, results, fighters, rankings, photos (pflmma.com)
    8. Gyms      scripts.scrape_gyms                 the gyms and the fighters who train in them (fighthub-app.com)

Usage (from the repo root):
    python -m scripts.update_all --dry-run      # ESPN preview only; rankings and photos write files, so they are skipped
    python -m scripts.update_all
    python -m scripts.update_all --skip-photos --since 2026-09-01

A failing step does not stop the following ones; the command exits with status 1 if any step failed.
Title changes (data/raw/title_reigns.csv) are still maintained by hand.
"""

from __future__ import annotations

import argparse
import sys
import traceback
from datetime import date, timedelta
from pathlib import Path
from typing import Callable

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from scripts import (
    download_fighter_photos, log_predictions, scrape_espn, scrape_fight_stats, scrape_fighter_origins, scrape_gyms, scrape_pfl, scrape_rankings,
    scrape_roster_watch, scrape_stat_leaders, validate_data,
)

# New fighters are a handful per week; the cap keeps a daily run short even if the origins file is ever behind.
ORIGINS_DAILY_LIMIT = 300
# Per-fight statistics for the fights of the last month; older ones were collected once and are never asked again.
FIGHT_STATS_DAYS = 30


def require_valid() -> None:
    problems = validate_data.validate()
    for problem in problems:
        print(f"[invalid] {problem}")
    for note in validate_data.warnings():
        print(f"[warn] {note}")
    if problems:
        raise RuntimeError("refreshed data failed validation")


def run_pfl(*, dry_run: bool, photos: bool) -> None:
    """The PFL scraper reports "nothing parsed" through its exit status, which run_step would not see."""
    status = scrape_pfl.main((["--dry-run"] if dry_run else []) + (["--photos"] if photos and not dry_run else []))
    if status != 0:
        raise RuntimeError("the PFL scraper found nothing; data/raw/pfl was left untouched")


def run_gyms(*, dry_run: bool) -> None:
    status = scrape_gyms.main(["--dry-run"] if dry_run else [])
    if status != 0:
        raise RuntimeError("the gym scraper found nothing; the gym files were left untouched")


def run_step(name: str, step: Callable[[], None]) -> bool:
    print(f"\n=== {name} ===")
    try:
        step()
    except Exception:  # noqa: BLE001 - report and keep going with the remaining steps
        print(f"[error] {name} failed:")
        traceback.print_exc()
        return False
    return True


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--dry-run", action="store_true", help="preview the ESPN step only; skip rankings and photos")
    parser.add_argument("--skip-espn", action="store_true")
    parser.add_argument("--skip-rankings", action="store_true")
    parser.add_argument("--skip-photos", action="store_true")
    parser.add_argument("--skip-origins", action="store_true")
    parser.add_argument("--skip-roster", action="store_true")
    parser.add_argument("--skip-records", action="store_true")
    parser.add_argument("--skip-pfl", action="store_true")
    parser.add_argument("--skip-gyms", action="store_true")
    parser.add_argument("--skip-predictions", action="store_true")
    parser.add_argument("--skip-stats", action="store_true", help="skip the per-fight statistics")
    parser.add_argument("--since", help="ESPN scan start date, YYYY-MM-DD (default: 30 days before the latest stored event)")
    parser.add_argument("--until", help="ESPN scan end date, YYYY-MM-DD")
    args = parser.parse_args(argv)

    espn_args = (["--dry-run"] if args.dry_run else []) + (["--since", args.since] if args.since else []) + (
        ["--until", args.until] if args.until else []
    )
    results: dict[str, bool | None] = {}

    # The picks are logged before ESPN runs, while upcoming cards are still upcoming, and settled after it.
    track = not (args.skip_predictions or args.dry_run)
    results["Log predictions"] = (
        run_step("Log predictions", lambda: print(f"[info] predictions logged: {log_predictions.log_upcoming()}"))
        if track
        else None
    )
    results["ESPN (events, results, fighters)"] = (
        None if args.skip_espn else run_step("ESPN (events, results, fighters)", lambda: scrape_espn.main(espn_args))
    )
    results["Settle predictions"] = (
        run_step("Settle predictions", lambda: print(f"[info] predictions settled: {log_predictions.resolve()}"))
        if track
        else None
    )
    if args.dry_run:
        print("\n[dry-run] rankings and photos skipped (they write files)")
        results["Fight statistics (ESPN)"] = results["UFC rankings"] = results["Photos (champions, new fighters)"] = None
        results["Fighter origins"] = results["Former roster"] = results["Record book"] = None
        # The PFL preview reads the site but writes nothing, so unlike the steps above it can run.
        results["PFL (pflmma.com)"] = None if args.skip_pfl else run_step("PFL (pflmma.com)", lambda: run_pfl(dry_run=True, photos=False))
        results["Gyms (FightHub)"] = None if args.skip_gyms else run_step("Gyms (FightHub)", lambda: run_gyms(dry_run=True))
    else:
        recent = (date.today() - timedelta(days=FIGHT_STATS_DAYS)).isoformat()
        results["Fight statistics (ESPN)"] = (
            None if args.skip_stats else run_step("Fight statistics (ESPN)", lambda: scrape_fight_stats.main(["--since", recent]))
        )
        results["UFC rankings"] = None if args.skip_rankings else run_step("UFC rankings", scrape_rankings.main)
        results["Photos (champions, new fighters)"] = (
            None
            if args.skip_photos
            else run_step("Photos (champions, new fighters)", lambda: download_fighter_photos.main([]))
        )
        results["Fighter origins"] = (
            None if args.skip_origins else run_step("Fighter origins", lambda: scrape_fighter_origins.main(["--limit", str(ORIGINS_DAILY_LIMIT)]))
        )
        results["Former roster"] = (
            None if args.skip_roster else run_step("Former roster (roster.watch)", scrape_roster_watch.main)
        )
        results["Record book"] = (
            None if args.skip_records else run_step("Record book (statleaders.ufc.com)", scrape_stat_leaders.main)
        )
        results["PFL (pflmma.com)"] = (
            None if args.skip_pfl else run_step("PFL (pflmma.com)", lambda: run_pfl(dry_run=False, photos=not args.skip_photos))
        )
        results["Gyms (FightHub)"] = None if args.skip_gyms else run_step("Gyms (FightHub)", lambda: run_gyms(dry_run=False))
        results["Validate"] = run_step("Validate refreshed data", require_valid)

    print("\n=== Summary ===")
    for name, ok in results.items():
        print(f"  {name}: {'skipped' if ok is None else 'ok' if ok else 'FAILED'}")
    return 1 if any(ok is False for ok in results.values()) else 0


if __name__ == "__main__":
    sys.exit(main())
