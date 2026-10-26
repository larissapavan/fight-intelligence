import csv
from datetime import date
from pathlib import Path

from scripts import check_title_fights


def write_csv(path: Path, rows: list[dict[str, str]], fieldnames: list[str]) -> None:
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def test_title_defense_increments_count_and_updates_detail(tmp_path: Path):
    reigns_file = tmp_path / "title_reigns.csv"
    cards_file = tmp_path / "event_cards.csv"
    details_file = tmp_path / "fight_details.csv"
    fighters_file = tmp_path / "fighters.csv"

    initial_reigns = [
        {
            "division": "Featherweight",
            "reign_order": "1",
            "reign_no_label": "1",
            "title_type": "undisputed",
            "champion": "Alexander Volkanovski",
            "fighter_url": "http://ufcstats.com/fighter-details/volk",
            "fighter_reign_index": "1",
            "won_how": "def. Max Holloway",
            "opponent_beaten": "Max Holloway",
            "event": "UFC 245",
            "location": "Las Vegas, NV, US",
            "date_won": "2019-12-14",
            "date_won_raw": "Dec 14, 2019",
            "days_held": "",
            "is_current": "True",
            "defenses_count": "0",
            "defenses_detail": "",
            "end_reason": "current",
        }
    ]
    write_csv(reigns_file, initial_reigns, check_title_fights.REIGNS_FIELDNAMES)

    cards = [
        {
            "event_name": "UFC 251: Usman vs. Masvidal",
            "event_date": "July 11, 2020",
            "location": "Abu Dhabi, UAE",
            "event_url": "http://ufcstats.com/event-details/251",
            "fight_url": "http://ufcstats.com/fight-details/volk-max-2",
            "fighter_1": "Alexander Volkanovski",
            "fighter_2": "Max Holloway",
            "winner": "Alexander Volkanovski",
            "weight_class": "Featherweight",
            "method": "S-DEC",
            "method_detail": "",
            "round": "5.0",
            "time": "5:00",
        }
    ]
    write_csv(cards_file, cards, list(cards[0].keys()))

    reigns, logs = check_title_fights.check_and_update_title_fights(
        reigns_path=reigns_file,
        cards_path=cards_file,
        details_path=details_file,
        fighters_path=fighters_file,
        apply=True,
    )

    assert any("[defense]" in log for log in logs)
    updated_reign = reigns[0]
    assert updated_reign["defenses_count"] == "1"
    assert "def. Max Holloway at UFC 251 on Jul 11, 2020" in updated_reign["defenses_detail"]
    assert updated_reign["is_current"] == "True"

    # Verify written to disk
    with reigns_file.open(encoding="utf-8") as f:
        disk_reigns = list(csv.DictReader(f))
    assert disk_reigns[0]["defenses_count"] == "1"


def test_title_change_closes_old_reign_and_creates_new_champion(tmp_path: Path):
    reigns_file = tmp_path / "title_reigns.csv"
    cards_file = tmp_path / "event_cards.csv"
    details_file = tmp_path / "fight_details.csv"
    fighters_file = tmp_path / "fighters.csv"

    initial_reigns = [
        {
            "division": "Bantamweight",
            "reign_order": "1",
            "reign_no_label": "1",
            "title_type": "undisputed",
            "champion": "Sean O'Malley",
            "fighter_url": "http://ufcstats.com/fighter-details/omalley",
            "fighter_reign_index": "1",
            "won_how": "def. Aljamain Sterling",
            "opponent_beaten": "Aljamain Sterling",
            "event": "UFC 292",
            "location": "Boston, MA, US",
            "date_won": "2023-08-19",
            "date_won_raw": "Aug 19, 2023",
            "days_held": "",
            "is_current": "True",
            "defenses_count": "1",
            "defenses_detail": "def. Marlon Vera at UFC 299 on Mar 9, 2024",
            "end_reason": "current",
        }
    ]
    write_csv(reigns_file, initial_reigns, check_title_fights.REIGNS_FIELDNAMES)

    cards = [
        {
            "event_name": "UFC 306: O'Malley vs. Dvalishvili",
            "event_date": "September 14, 2024",
            "location": "Las Vegas, NV, US",
            "event_url": "http://ufcstats.com/event-details/306",
            "fight_url": "http://ufcstats.com/fight-details/omalley-merab",
            "fighter_1": "Sean O'Malley",
            "fighter_2": "Merab Dvalishvili",
            "winner": "Merab Dvalishvili",
            "weight_class": "Bantamweight",
            "method": "U-DEC",
            "method_detail": "",
            "round": "5.0",
            "time": "5:00",
        }
    ]
    write_csv(cards_file, cards, list(cards[0].keys()))

    reigns, logs = check_title_fights.check_and_update_title_fights(
        reigns_path=reigns_file,
        cards_path=cards_file,
        details_path=details_file,
        fighters_path=fighters_file,
        apply=True,
    )

    assert any("[title change]" in log for log in logs)
    assert len(reigns) == 2

    old_reign = reigns[0]
    assert old_reign["is_current"] == "False"
    assert old_reign["end_reason"] == "lost_title_fight"
    assert int(old_reign["days_held"]) > 300

    new_reign = reigns[1]
    assert new_reign["champion"] == "Merab Dvalishvili"
    assert new_reign["division"] == "Bantamweight"
    assert new_reign["reign_order"] == "2"
    assert new_reign["reign_no_label"] == "2"
    assert new_reign["won_how"] == "def. Sean O'Malley"
    assert new_reign["opponent_beaten"] == "Sean O'Malley"
    assert new_reign["event"] == "UFC 306"
    assert new_reign["date_won"] == "2024-09-14"
    assert new_reign["is_current"] == "True"
    assert new_reign["defenses_count"] == "0"


def test_check_title_fights_idempotent_when_already_recorded(tmp_path: Path):
    reigns_file = tmp_path / "title_reigns.csv"
    cards_file = tmp_path / "event_cards.csv"
    details_file = tmp_path / "fight_details.csv"
    fighters_file = tmp_path / "fighters.csv"

    initial_reigns = [
        {
            "division": "Featherweight",
            "reign_order": "1",
            "reign_no_label": "1",
            "title_type": "undisputed",
            "champion": "Alexander Volkanovski",
            "fighter_url": "http://ufcstats.com/fighter-details/volk",
            "fighter_reign_index": "1",
            "won_how": "def. Max Holloway",
            "opponent_beaten": "Max Holloway",
            "event": "UFC 245",
            "location": "Las Vegas, NV, US",
            "date_won": "2019-12-14",
            "date_won_raw": "Dec 14, 2019",
            "days_held": "",
            "is_current": "True",
            "defenses_count": "1",
            "defenses_detail": "def. Max Holloway at UFC 251 on Jul 11, 2020",
            "end_reason": "current",
        }
    ]
    write_csv(reigns_file, initial_reigns, check_title_fights.REIGNS_FIELDNAMES)

    cards = [
        {
            "event_name": "UFC 251: Usman vs. Masvidal",
            "event_date": "July 11, 2020",
            "location": "Abu Dhabi, UAE",
            "event_url": "http://ufcstats.com/event-details/251",
            "fight_url": "http://ufcstats.com/fight-details/volk-max-2",
            "fighter_1": "Alexander Volkanovski",
            "fighter_2": "Max Holloway",
            "winner": "Alexander Volkanovski",
            "weight_class": "Featherweight",
            "method": "S-DEC",
            "method_detail": "",
            "round": "5.0",
            "time": "5:00",
        }
    ]
    write_csv(cards_file, cards, list(cards[0].keys()))

    reigns, logs = check_title_fights.check_and_update_title_fights(
        reigns_path=reigns_file,
        cards_path=cards_file,
        details_path=details_file,
        fighters_path=fighters_file,
        apply=True,
    )

    assert any("[up to date]" in log for log in logs)
    assert reigns[0]["defenses_count"] == "1"


def test_dry_run_does_not_modify_file_on_disk(tmp_path: Path):
    reigns_file = tmp_path / "title_reigns.csv"
    cards_file = tmp_path / "event_cards.csv"
    details_file = tmp_path / "fight_details.csv"
    fighters_file = tmp_path / "fighters.csv"

    initial_reigns = [
        {
            "division": "Featherweight",
            "reign_order": "1",
            "reign_no_label": "1",
            "title_type": "undisputed",
            "champion": "Alexander Volkanovski",
            "fighter_url": "http://ufcstats.com/fighter-details/volk",
            "fighter_reign_index": "1",
            "won_how": "def. Max Holloway",
            "opponent_beaten": "Max Holloway",
            "event": "UFC 245",
            "location": "Las Vegas, NV, US",
            "date_won": "2019-12-14",
            "date_won_raw": "Dec 14, 2019",
            "days_held": "",
            "is_current": "True",
            "defenses_count": "0",
            "defenses_detail": "",
            "end_reason": "current",
        }
    ]
    write_csv(reigns_file, initial_reigns, check_title_fights.REIGNS_FIELDNAMES)

    cards = [
        {
            "event_name": "UFC 251: Usman vs. Masvidal",
            "event_date": "July 11, 2020",
            "location": "Abu Dhabi, UAE",
            "event_url": "http://ufcstats.com/event-details/251",
            "fight_url": "http://ufcstats.com/fight-details/volk-max-2",
            "fighter_1": "Alexander Volkanovski",
            "fighter_2": "Max Holloway",
            "winner": "Alexander Volkanovski",
            "weight_class": "Featherweight",
            "method": "S-DEC",
            "method_detail": "",
            "round": "5.0",
            "time": "5:00",
        }
    ]
    write_csv(cards_file, cards, list(cards[0].keys()))

    reigns, logs = check_title_fights.check_and_update_title_fights(
        reigns_path=reigns_file,
        cards_path=cards_file,
        details_path=details_file,
        fighters_path=fighters_file,
        apply=False,
    )

    assert any("[dry-run]" in log for log in logs)
    # File on disk must remain unchanged
    with reigns_file.open(encoding="utf-8") as f:
        disk_reigns = list(csv.DictReader(f))
    assert disk_reigns[0]["defenses_count"] == "0"
