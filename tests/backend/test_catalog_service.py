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
    for column in ("name", "wins", "losses", "age", "sig_str_acc", "takedown_acc", "stance"):
        assert column in catalog.columns


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
