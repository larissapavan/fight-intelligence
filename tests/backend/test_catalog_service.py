import pandas as pd
import pytest

from backend.app.services.catalog_service import (
    _age_from_dob,
    _parse_percent,
    get_fighter_catalog,
    get_fighter_profile,
)


def test_catalog_has_expected_columns_and_is_not_empty():
    catalog = get_fighter_catalog()
    assert len(catalog) > 1000
    for column in (
        "name",
        "wins",
        "losses",
        "age",
        "sig_str_acc",
        "takedown_acc",
        "slpm",
        "sapm",
        "str_def",
        "td_avg",
        "td_def",
        "sub_avg",
        "stance",
    ):
        assert column in catalog.columns


def test_fighter_profile_exposes_full_career_stat_block():
    """Regression guard: the striking/grappling stat block (SLpM, Str. Def, TD Def,
    Sub. Avg, ...) scraped from ufcstats.com must reach the API response, not just
    live inside the internal dataframe.
    """
    catalog = get_fighter_catalog()
    name = catalog.iloc[0]["name"]
    profile = get_fighter_profile(name)
    for field in (
        "sig_strikes_landed_per_min",
        "sig_strikes_absorbed_per_min",
        "striking_defense",
        "takedown_avg_per_15min",
        "takedown_defense",
        "submission_avg_per_15min",
    ):
        assert field in profile


def test_different_fighters_do_not_all_share_identical_model_inputs():
    """Regression test: age/sig_str_acc/takedown_acc must come from real per-fighter
    data, not a single hardcoded fallback applied to every fighter. Before this was
    fixed, every fighter had the exact same (default) values for these fields, which
    silently zeroed out several of the model's features on every live prediction.
    """

    catalog = get_fighter_catalog()
    with_age = catalog[catalog["age"].notna()]
    assert len(with_age) > 100, "Expected most fighters to have a real scraped age by now."
    assert with_age["age"].nunique() > 10
    assert catalog["sig_str_acc"].nunique() > 10
    assert catalog["takedown_acc"].nunique() > 10


def test_get_fighter_profile_unknown_name_raises_key_error():
    with pytest.raises(KeyError):
        get_fighter_profile("Definitely Not A Real Fighter Name")


def test_get_fighter_profile_returns_matching_name():
    catalog = get_fighter_catalog()
    name = catalog.iloc[0]["name"]
    profile = get_fighter_profile(name)
    assert profile["name"] == name


@pytest.mark.parametrize(
    ("dob_text", "expected_is_none"),
    [
        ("--", True),
        ("", True),
        (None, True),
        ("Jul 13, 1978", False),
    ],
)
def test_age_from_dob_handles_missing_values(dob_text, expected_is_none):
    result = _age_from_dob(dob_text)
    assert (result is None) is expected_is_none


def test_age_from_dob_computes_a_plausible_age():
    age = _age_from_dob("Jan 01, 1990")
    assert age is not None
    assert 30 <= age <= 40


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("50%", 0.5),
        ("0%", 0.0),
        ("--", None),
        (None, None),
        (pd.NA, None),
    ],
)
def test_parse_percent(value, expected):
    assert _parse_percent(value) == expected


def test_hand_written_hometowns_override_what_ufc_com_lists(client):
    fighters = {fighter["name"]: fighter for fighter in client.get("/fighters").json()}

    # ufc.com lists only "Germany" for him; the override file carries the city.
    assert fighters["Ilia Topuria"]["hometown"] == "Halle, Germany"
    # The flag is unaffected: he represents Georgia.
    assert fighters["Ilia Topuria"]["country_code"] == "ge"


def test_aliases_fold_a_duplicate_row_into_the_real_fighter(client):
    fighters = {fighter["name"]: fighter for fighter in client.get("/fighters").json()}

    # ESPN created "Tina Black" from the nickname; she is Valesca Machado. One row remains, with the roster data merged in.
    assert "Tina Black" not in fighters
    machado = fighters["Valesca Machado"]
    assert machado["nickname"] == "Tina Black"
    assert machado["badges"] and machado["country_code"] == "br"
    assert machado["ufc_status"] == "active"


def test_profiles_and_cards_resolve_alias_spellings(client):
    # An alias asks for the same profile as the real name.
    assert client.get("/fighters/Tina Black/performance").status_code == 200

    # Upcoming cards use the catalog spelling, so every fighter on them has a profile and a pick.
    names = {fighter["name"] for fighter in client.get("/fighters").json()}
    announced = {name for event in client.get("/events/upcoming").json() for fight in event["fights"] for name in (fight["fighter_1"], fight["fighter_2"]) if name}
    aliases = {entry for entry in ("Jose Mauro Delano", "Wesley Schultz", "Ko Seok-hyeon", "Lee Jeong-yeong", "Tina Black")}
    assert not announced & aliases  # the alias spellings never reach the page
    assert not {name for name in announced if name not in names}  # and every announced fighter has a profile


def test_alias_lookup_reads_the_file_once_not_once_per_fight(monkeypatch):
    from backend.app.services import catalog_service as service

    reads = []
    real_read = service.pd.read_csv
    monkeypatch.setattr(service.pd, "read_csv", lambda path, *args, **kwargs: reads.append(str(path)) or real_read(path, *args, **kwargs))
    service._aliases_cache.update({"signature": None, "data": {}})

    for _ in range(500):
        service.canonical_name("Wesley Schultz")

    assert reads.count(str(service.NAME_ALIASES_PATH)) == 1
    assert service.canonical_name("Wesley Schultz") == "Wes Schultz"


def test_a_hand_kept_status_beats_a_roster_that_has_not_caught_up(client):
    fighters = {fighter["name"]: fighter for fighter in client.get("/fighters").json()}

    # Released by the UFC while roster.watch still lists him as active.
    assert fighters["Farid Basharat"]["is_active"] is False
    assert fighters["Farid Basharat"]["ufc_status"] == "former"


def test_debut_division_uses_the_roster_class_and_never_gives_a_woman_a_men_s_division():
    from backend.app.services.catalog_service import _debut_division

    # 145 lbs is a men's featherweight by weight alone, but the roster lists her at women's bantamweight.
    assert _debut_division("women's bantamweight", 145.0, True) == "Women's Bantamweight"
    # No roster data: the weight decides, with the women's division names.
    assert _debut_division(None, 145.0, True) == "Women's Featherweight"
    assert _debut_division(float("nan"), 125.0, True) == "Women's Flyweight"
    assert _debut_division(None, 145.0, False) == "Featherweight"
    # Two listed classes: the one matching the profile weight, else the first listed. Openweight is not a division.
    assert _debut_division("middleweight, welterweight", 170.0, False) == "Welterweight"
    assert _debut_division("middleweight, welterweight", 200.0, False) == "Middleweight"
    assert _debut_division("openweight", 170.0, False) == "Welterweight"
