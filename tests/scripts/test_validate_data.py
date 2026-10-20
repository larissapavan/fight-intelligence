from scripts import validate_data


def test_read_rows_parses_quoted_fields():
    rows = validate_data.read_rows('a,b\n"x, y",z\n')
    assert rows == [["a", "b"], ["x, y", "z"]]


def test_validate_flags_missing_files(tmp_path, monkeypatch):
    monkeypatch.setattr(validate_data, "RAW_DIR", tmp_path)
    problems = validate_data.validate()
    assert any("events.csv: file is missing" in p for p in problems)


def write(path, text):
    path.write_text(text, encoding="utf-8")


def test_champion_mismatch_names_the_division_where_rankings_and_reigns_disagree(tmp_path, monkeypatch):
    monkeypatch.setattr(validate_data, "RAW_DIR", tmp_path)
    write(
        tmp_path / "rankings.csv",
        "category,is_p4p,rank,fighter,rank_change,athlete_url\n"
        "Flyweight,False,0,New Champ,,/a\n"
        "Bantamweight,False,0,Peter O'Malley,,/b\n"
        "Bantamweight,False,1,Someone Else,,/c\n"
        "Pound-for-Pound (Men's),True,0,Whoever,,/d\n",
    )
    write(
        tmp_path / "title_reigns.csv",
        "division,title_type,champion,is_current\n"
        "Flyweight,undisputed,Old Champ,True\n"
        "Bantamweight,undisputed,Peter O'Malley,True\n"
        "Bantamweight,interim,Interim Guy,True\n",
    )

    notes = validate_data.champion_mismatches()
    assert notes == ["Flyweight: rankings say New Champ, title_reigns.csv says Old Champ"]


def test_champion_mismatch_ignores_spelling_and_a_missing_file(tmp_path, monkeypatch):
    monkeypatch.setattr(validate_data, "RAW_DIR", tmp_path)
    assert validate_data.champion_mismatches() == []  # nothing to compare

    write(tmp_path / "rankings.csv", "category,is_p4p,rank,fighter,rank_change,athlete_url\nFlyweight,False,0,Joshua  Van,,/a\n")
    write(tmp_path / "title_reigns.csv", "division,title_type,champion,is_current\nFlyweight,undisputed,joshua van,True\n")
    assert validate_data.champion_mismatches() == []


RANK_HEADER = "category,is_p4p,rank,fighter,rank_change,athlete_url\n"
UPCOMING_HEADER = "event_name,event_date,location,event_url,fight_url,fighter_1,fighter_2,winner,weight_class,method,method_detail,round,time\n"


def test_rankings_allow_a_tie_but_flag_a_repeated_fighter_and_a_bad_rank(tmp_path, monkeypatch):
    monkeypatch.setattr(validate_data, "RAW_DIR", tmp_path)
    write(tmp_path / "rankings.csv", RANK_HEADER + "Flyweight,False,6,A One,,/a\nFlyweight,False,6,B Two,,/b\nFlyweight,False,8,C Three,,/c\n")
    assert validate_data.rankings_structure_problems() == []

    write(tmp_path / "rankings.csv", RANK_HEADER + "Flyweight,False,1,A One,,/a\nFlyweight,False,2,a one,,/a\nFlyweight,False,16,C Three,,/c\n")
    problems = validate_data.rankings_structure_problems()
    assert any("same fighter twice" in p for p in problems)
    assert any("outside 0-15" in p for p in problems)


def test_pound_for_pound_must_not_have_a_champion_row(tmp_path, monkeypatch):
    monkeypatch.setattr(validate_data, "RAW_DIR", tmp_path)
    write(tmp_path / "rankings.csv", RANK_HEADER + "Pound-for-Pound (Men's),True,0,A One,,/a\n")
    assert any("pound-for-pound" in p for p in validate_data.rankings_structure_problems())


def test_upcoming_flags_a_half_bout_a_self_fight_and_a_double_booking(tmp_path, monkeypatch):
    monkeypatch.setattr(validate_data, "RAW_DIR", tmp_path)
    head = "UFC 1,\"January 01, 2030\",Here,,,"
    write(
        tmp_path / "upcoming_events.csv",
        UPCOMING_HEADER + f"{head}A One,B Two,,,,,,\n{head}A One,C Three,,,,,,\n{head}D Four,D Four,,,,,,\n{head}E Five,,,,,,,\nUFC 2,\"January 08, 2030\",Here,,,,,,,,,,\n",
    )
    problems = validate_data.upcoming_structure_problems()
    assert any("booked more than once" in p for p in problems)
    assert any("against themself" in p for p in problems)
    assert any("missing a fighter" in p for p in problems)
    assert not any("UFC 2" in p for p in problems)  # an event with no bouts yet is fine


def test_non_numeric_records_are_flagged(tmp_path, monkeypatch):
    monkeypatch.setattr(validate_data, "RAW_DIR", tmp_path)
    write(tmp_path / "fighters.csv", "first_name,last_name,wins,losses,draws\nA,One,5,2,0\nB,Two,x,1,0\n")
    assert validate_data.fighter_record_problems() == ["fighters.csv: 1 fighters have a non-numeric record (first: B Two)"]


def test_unmatched_names_use_aliases_and_stale_cards_are_listed(tmp_path, monkeypatch):
    from datetime import date

    monkeypatch.setattr(validate_data, "RAW_DIR", tmp_path)
    write(tmp_path / "fighters.csv", "first_name,last_name,wins,losses,draws\nJose,Delano,5,2,0\nA,One,1,0,0\n")
    write(tmp_path / "name_aliases.csv", "alias,canonical,note\nJose Mauro Delano,Jose Delano,x\n")
    write(tmp_path / "rankings.csv", RANK_HEADER + "Flyweight,False,1,A One,,/a\nFlyweight,False,2,Ghost Fighter,,/g\n")
    write(
        tmp_path / "upcoming_events.csv",
        UPCOMING_HEADER + "UFC 1,\"January 01, 2030\",Here,,,Jose Mauro Delano,A One,,,,,,\nUFC Old,\"January 01, 2020\",Here,,,A One,B Two,,,,,,\n",
    )
    names = validate_data.unmatched_names()
    assert any("Ghost Fighter" in n for n in names) and any("B Two" in n for n in names)
    assert not any("Delano" in n for n in names)
    assert validate_data.stale_upcoming(today=date(2026, 10, 20)) == ["UFC Old (January 01, 2020) is still listed as upcoming"]


def test_validate_reports_structure_problems(tmp_path, monkeypatch):
    monkeypatch.setattr(validate_data, "RAW_DIR", tmp_path)
    write(tmp_path / "rankings.csv", RANK_HEADER + "Flyweight,False,1,A One,,/a\nFlyweight,False,2,A One,,/a\n")
    assert any("same fighter twice" in p for p in validate_data.validate())


def test_a_photo_listed_in_the_manifest_must_exist_on_disk(tmp_path, monkeypatch):
    monkeypatch.setattr(validate_data, "RAW_DIR", tmp_path)
    present = tmp_path / "a.webp"
    present.write_bytes(b"x")
    header = "name,kind,source,source_url,image_url,local_path,checked\n"
    write(tmp_path / "fighter_photos.csv", header + f"A One,espn,ESPN,,,{present},2026-10-20\nB Two,espn,ESPN,,,,2026-10-20\n")
    assert validate_data.photo_manifest_problems() == []  # a row with no photo is fine

    write(tmp_path / "fighter_photos.csv", header + f"A One,espn,ESPN,,,{present},2026-10-20\nGhost,espn,ESPN,,,{tmp_path / 'gone.webp'},2026-10-20\n")
    assert validate_data.photo_manifest_problems() == ["fighter_photos.csv: 1 listed photos are missing on disk (first: Ghost)"]
