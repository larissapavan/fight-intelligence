import math

import pytest

from scripts import compare_models as compare
from src.ufc_predictor.prefight import Fight


def test_percent_strings_from_the_career_file_become_fractions():
    assert compare.percent("42%") == pytest.approx(0.42) and compare.percent(" 7% ") == pytest.approx(0.07)
    assert math.isnan(compare.percent("--")) and math.isnan(compare.percent(""))


def test_the_record_outside_the_ufc_is_the_career_record_minus_the_ufc_record():
    fights = [
        Fight(day=None, fight_url="1", first="ann", second="bea", winner="ann"),
        Fight(day=None, fight_url="2", first="ann", second="cat", winner="cat"),
        Fight(day=None, fight_url="3", first="bea", second="cat", winner=""),  # a draw counts for neither
    ]
    totals = {"ann": {"wins": 10.0, "losses": 3.0}, "bea": {"wins": 2.0, "losses": 5.0}, "cat": {"wins": 0.0, "losses": 0.0}}
    outside = compare.pre_ufc_records(fights, totals)
    assert outside["ann"] == (9, 2) and outside["bea"] == (2, 4)
    assert outside["cat"] == (0, 0)  # never negative, even when the file's totals lag behind the UFC record


def test_the_table_says_so_when_a_number_was_never_reported():
    reported = {"accuracy": 0.747, "roc_auc": 0.824, "log_loss": 0.511, "brier": float("nan"), "ece": float("nan")}
    lines = compare.table([("Deployed, as reported", reported)])
    assert lines[-1] == "| Deployed, as reported | 74.7% | 0.824 | 0.511 | not reported | not reported |"
    assert "nan" not in lines[-1]


def test_the_evaluation_record_has_what_the_site_needs():
    import numpy as np
    import pandas as pd

    test = pd.DataFrame({"date": pd.to_datetime(["2024-01-06", "2024-03-02", "2024-05-04", "2024-05-04"])})
    p = np.array([0.95, 0.92, 0.2, 0.6])  # two confident calls (one right, one wrong), a right 80% for the other side, a right 60%
    y = np.array([1, 0, 0, 1])
    record = compare.evaluation_record(test, p, y)
    assert (record["fights"], record["start"], record["end"]) == (4, "2024-01-06", "2024-05-04")
    assert record["accuracy"] == 0.75 and record["confident_fights"] == 2 and record["confident_hit_rate"] == 0.5
    assert {"roc_auc", "log_loss", "brier", "ece"} <= set(record)
    none_confident = compare.evaluation_record(test, np.array([0.6, 0.55, 0.4, 0.6]), y)
    assert none_confident["confident_fights"] == 0 and none_confident["confident_hit_rate"] is None
