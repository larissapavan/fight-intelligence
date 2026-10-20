"""A matchup must read the same whichever fighter is typed first.

The model learned that the red corner wins more often, so asked about (A, B) and (B, A) it used to give answers that
did not add up to 100%. PredictionService averages the two orders; these tests hold it to that on real fighters.
"""

import random
import statistics

import pytest

from backend.app.services.catalog_service import get_fighter_profile, list_fighters
from backend.app.services.prediction_service import PredictionService, _first_wins

TOLERANCE = 1e-9
# SHAP's probability output is only approximately additive. Over 300 random pairs of active fighters the factors miss
# p - 0.5 by a median of 0.0025, 0.034 at the 99th percentile and 0.041 at worst (a single order is off by up to 0.086).
# So one pair gets a ceiling above that worst case, and the median over all the pairs is held much tighter. A wrong
# sign breaks both checks. A wrong corner mapping does not change the sum (it only shuffles the same values), so the
# factor comparison between the two orders is the test that catches it.
SHAP_SUM_CEILING = 0.05
SHAP_SUM_MEDIAN = 0.01

NAMED_PAIRS = [
    ("Islam Makhachev", "Arman Tsarukyan"),
    ("Jon Jones", "Tom Aspinall"),
    ("Alex Pereira", "Magomed Ankalaev"),
]


def _sampled_pairs(count: int = 25) -> list[tuple[str, str]]:
    """Real pairs of active fighters, the same ones on every run."""
    names = sorted(fighter["name"] for fighter in list_fighters(ufc_only=True) if fighter["is_active"])
    rng = random.Random(20261020)
    pairs: list[tuple[str, str]] = []
    while len(pairs) < count:
        a, b = rng.sample(names, 2)
        pairs.append((a, b))
    return pairs


PAIRS = NAMED_PAIRS + _sampled_pairs()


@pytest.fixture(scope="module")
def service() -> PredictionService:
    return PredictionService()


def _owned(feature: str, first: str, second: str) -> str:
    """A factor label with the fighter it belongs to spelled out, so the two orders can be compared.

    "Fighter A win rate" is the first fighter's in one order and the second's in the other; "Red Age" and "Blue Age" are
    the labels the unmapped columns still carry. Differences ("Wins difference") belong to nobody and stay as they are."""
    for prefix, owner in (("Fighter A ", first), ("Red ", first), ("Fighter B ", second), ("Blue ", second)):
        if feature.startswith(prefix):
            return f"{owner} {feature[len(prefix):]}"
    return feature


@pytest.mark.parametrize(("a", "b"), PAIRS)
def test_the_win_probability_is_the_same_in_both_orders(service, a, b):
    forward = service.predict_matchup(a, b)
    backward = service.predict_matchup(b, a)

    assert abs(forward["fighter_a_probability"] + forward["fighter_b_probability"] - 1.0) < TOLERANCE
    assert abs(forward["fighter_a_probability"] - backward["fighter_b_probability"]) < TOLERANCE
    assert abs(forward["fighter_b_probability"] - backward["fighter_a_probability"]) < TOLERANCE
    assert abs(forward["probability"] - backward["probability"]) < TOLERANCE
    assert forward["predicted_winner"] == backward["predicted_winner"]


@pytest.mark.parametrize(("a", "b"), PAIRS)
def test_the_pick_is_the_same_in_both_orders_and_matches_the_full_prediction(service, a, b):
    forward = service.predict_pick(a, b)
    backward = service.predict_pick(b, a)

    assert abs(forward["fighter_a_probability"] + backward["fighter_a_probability"] - 1.0) < TOLERANCE
    assert forward["predicted_winner"] == backward["predicted_winner"]
    assert abs(forward["probability"] - backward["probability"]) < TOLERANCE

    full = service.predict_matchup(a, b)  # the list view and the detail view must agree
    assert forward["predicted_winner"] == full["predicted_winner"]
    assert abs(forward["fighter_a_probability"] - full["fighter_a_probability"]) < TOLERANCE


@pytest.mark.parametrize(("a", "b"), PAIRS)
def test_the_main_factors_are_the_same_in_both_orders(service, a, b):
    forward = service.predict_matchup(a, b)["main_factors"]
    backward = service.predict_matchup(b, a)["main_factors"]
    assert forward and len(forward) == len(backward)

    def comparable(factors, first, second):
        return sorted((_owned(f["feature"], first, second), f["impact"], f["magnitude"]) for f in factors)

    for (feature_f, impact_f, size_f), (feature_b, impact_b, size_b) in zip(
        comparable(forward, a, b), comparable(backward, b, a), strict=True
    ):
        assert feature_f == feature_b
        assert impact_f == impact_b  # pushes toward the same fighter, by name
        assert abs(size_f - size_b) < TOLERANCE


@pytest.mark.parametrize(("a", "b"), PAIRS)
def test_the_factors_add_up_to_the_probability_in_both_orders(service, a, b):
    x_ab, x_ba = service._both_orders(get_fighter_profile(a), get_fighter_profile(b))
    p = service._symmetric_probability(x_ab, x_ba)

    forward = service._combined_attributions(x_ab, x_ba)
    backward = service._combined_attributions(x_ba, x_ab)

    # The baseline is a coin flip: all the factors together move 50% to the final probability.
    assert abs(forward.sum() - (p - 0.5)) < SHAP_SUM_CEILING
    assert abs(backward.sum() - ((1.0 - p) - 0.5)) < SHAP_SUM_CEILING
    # Swapping the fighters turns every push around: same size, opposite direction, on the same fighter's features.
    assert abs(forward.sum() + backward.sum()) < TOLERANCE


def test_the_factors_add_up_closely_for_the_typical_matchup(service):
    gaps = []
    for a, b in PAIRS:
        x_ab, x_ba = service._both_orders(get_fighter_profile(a), get_fighter_profile(b))
        p = service._symmetric_probability(x_ab, x_ba)
        gaps.append(abs(service._combined_attributions(x_ab, x_ba).sum() - (p - 0.5)))
    assert statistics.median(gaps) < SHAP_SUM_MEDIAN


def test_a_fighter_against_themself_is_a_coin_flip(service):
    result = service.predict_matchup("Islam Makhachev", "Islam Makhachev")
    assert abs(result["fighter_a_probability"] - 0.5) < TOLERANCE
    assert abs(result["fighter_b_probability"] - 0.5) < TOLERANCE


def test_an_exact_tie_goes_to_the_same_fighter_whatever_the_order():
    assert _first_wins(0.5, "Amy Adams", "Zed Zimmer") is True
    assert _first_wins(0.5, "Zed Zimmer", "Amy Adams") is False
    assert _first_wins(0.5 + 1e-13, "Zed Zimmer", "Amy Adams") is False  # rounding noise is still a tie
    assert _first_wins(0.51, "Zed Zimmer", "Amy Adams") is True
    assert _first_wins(0.49, "Amy Adams", "Zed Zimmer") is False


@pytest.mark.parametrize(("a", "b"), NAMED_PAIRS)
def test_the_api_gives_the_same_answer_in_both_orders(client, a, b):
    forward = client.post("/predict", json={"fighter_a": a, "fighter_b": b}).json()
    backward = client.post("/predict", json={"fighter_a": b, "fighter_b": a}).json()

    assert abs(forward["fighter_a_probability"] - backward["fighter_b_probability"]) < TOLERANCE
    assert forward["predicted_winner"] == backward["predicted_winner"]
    assert forward["probability"] == pytest.approx(backward["probability"], abs=TOLERANCE)


def test_factor_labels_never_mention_a_corner_color():
    from backend.app.services.prediction_service import pretty_feature_name

    service_columns = PredictionService().feature_columns
    labels = {column: pretty_feature_name(column) for column in service_columns}
    assert not [label for label in labels.values() if label.startswith(("Red ", "Blue "))]
    assert labels["red_age"] == "Fighter A age" and labels["blue_age"] == "Fighter B age"
    assert labels["red_reach_cm"] == "Fighter A reach" and labels["blue_sig_str_acc"] == "Fighter B striking accuracy"
    assert labels["red_stance_Southpaw"] == "Fighter A stance: Southpaw"
    assert labels["age_diff"] == "Age difference" and labels["fight_year"] == "Fight year"  # unchanged
