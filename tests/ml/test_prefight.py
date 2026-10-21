"""The training data may only know what was known before each fight."""

import math
from datetime import date

import numpy as np
import pandas as pd
import pytest
from sklearn.dummy import DummyClassifier
from sklearn.pipeline import Pipeline

from src.ufc_predictor import prefight, train_prefight
from src.ufc_predictor.prefight import (
    DIFF_FEATURES, FEATURE_COLUMNS, Fight, FighterState, HistoryTracker, Static, a_is_first, build_dataset, fight_seconds,
    fighter_features, matchup_row, mirror, replay,
)


def stats(sig_landed=20, sig_attempted=50, td_landed=1, td_attempted=3, knockdowns=0, control=30, subs=0):
    return {
        "knockdowns": knockdowns, "sig_landed": sig_landed, "sig_attempted": sig_attempted, "total_landed": sig_landed,
        "total_attempted": sig_attempted, "td_landed": td_landed, "td_attempted": td_attempted,
        "submission_attempts": subs, "reversals": 0, "advances": 0, "control_seconds": control,
    }


NAMES = ["ann", "bea", "cat", "dee", "eve", "fay"]
STATICS = {n: Static(dob=date(1990, 1, 1 + i), height=170.0 + i, reach=175.0 + i, stance="orthodox" if i % 2 else "southpaw") for i, n in enumerate(NAMES)}


def make_fights(n: int = 40, seed: int = 0) -> list[Fight]:
    """A made-up history: pairs of the six fighters, a fight almost every day, with strikes and takedowns."""
    rng = np.random.default_rng(seed)
    fights = []
    for i in range(n):
        first, second = rng.choice(NAMES, size=2, replace=False)
        winner = str(rng.choice([first, second]))
        fights.append(Fight(
            day=date.fromordinal(date(2020, 1, 1).toordinal() + i * 3 // 2), fight_url=f"fight-{i:03d}", first=str(first), second=str(second),
            winner=winner, method=str(rng.choice(["KO/TKO", "SUB", "U-DEC"])), seconds=float(rng.integers(60, 900)),
            stats={str(first): stats(sig_landed=int(rng.integers(5, 60))), str(second): stats(sig_landed=int(rng.integers(5, 60)))},
            scheduled_rounds=3.0, title_fight=0.0, weight_class="Lightweight", first_name=str(first), second_name=str(second),
        ))
    # two fights never share a fighter on one day: keep the first appearance of each fighter per day
    seen: set[tuple] = set()
    kept = []
    for f in fights:
        if (f.day, f.first) in seen or (f.day, f.second) in seen:
            continue
        seen |= {(f.day, f.first), (f.day, f.second)}
        kept.append(f)
    return kept


def features_of(rows: pd.DataFrame, url: str) -> pd.Series:
    return rows.set_index("fight_url").loc[url, FEATURE_COLUMNS].astype(float)


# --------------------------------------------------------------------------- nothing from the future


def test_later_fights_never_change_the_features_of_an_earlier_one():
    fights = make_fights()
    cut = len(fights) // 2
    early = build_dataset(fights[:cut], STATICS)
    everything = build_dataset(fights, STATICS)
    for url in early["fight_url"]:
        pd.testing.assert_series_equal(features_of(early, url), features_of(everything, url), check_names=False)


def test_a_fights_own_result_and_stats_never_change_its_own_features():
    fights = make_fights()
    index = len(fights) // 2
    original = build_dataset(fights, STATICS)

    altered = [Fight(**{**f.__dict__}) for f in fights]
    target = altered[index]
    target.winner = target.second if target.winner == target.first else target.first
    target.method = "SUB" if target.method != "SUB" else "KO/TKO"
    target.stats = {target.first: stats(sig_landed=99, sig_attempted=100), target.second: stats(sig_landed=1, sig_attempted=100)}
    target.seconds = 899.0
    changed = build_dataset(altered, STATICS)

    url = target.fight_url
    pd.testing.assert_series_equal(features_of(original, url), features_of(changed, url), check_names=False)
    # ... and the label did follow the result
    assert original.set_index("fight_url").at[url, "y"] != changed.set_index("fight_url").at[url, "y"]
    # the fights before it are untouched too
    for earlier in fights[:index]:
        pd.testing.assert_series_equal(features_of(original, earlier.fight_url), features_of(changed, earlier.fight_url), check_names=False)


def test_a_snapshot_is_a_copy_so_later_fights_cannot_leak_into_it():
    """The bug this guards against: a snapshot that shared its list of recent results with the live state."""
    tracker = HistoryTracker()
    one = Fight(day=date(2020, 1, 1), fight_url="a", first="ann", second="bea", winner="ann", stats={"ann": stats(), "bea": stats()}, seconds=600.0)
    tracker.apply([one], {"ann": tracker.snapshot("ann"), "bea": tracker.snapshot("bea")})
    snapshot = tracker.snapshot("ann")
    recent, wins, sig = list(snapshot.recent), snapshot.wins, snapshot.sig_landed

    two = Fight(day=date(2020, 2, 1), fight_url="b", first="ann", second="cat", winner="cat", stats={"ann": stats(), "cat": stats()}, seconds=300.0)
    tracker.apply([two], {"ann": tracker.snapshot("ann"), "cat": tracker.snapshot("cat")})
    assert (snapshot.recent, snapshot.wins, snapshot.sig_landed) == (recent, wins, sig)
    assert snapshot.recent is not tracker.states["ann"].recent


def test_a_fighters_first_fight_has_no_history_and_the_features_say_so():
    row = build_dataset(make_fights(), STATICS).iloc[0]
    assert row["ufc_fights_diff"] == 0 and row["ufc_wins_diff"] == 0 and row["streak_diff"] == 0
    assert math.isnan(row["days_off_diff"]) and math.isnan(row["sig_acc_diff"]) and math.isnan(row["form_diff"])


def test_fights_on_the_same_day_are_all_described_from_before_that_day():
    day = date(2021, 5, 1)
    history = [Fight(day=date(2021, 1, 1), fight_url="old", first="ann", second="bea", winner="ann", stats={}, seconds=300.0)]
    todays = [
        Fight(day=day, fight_url="x", first="ann", second="cat", winner="ann", stats={}, seconds=300.0, first_name="ann", second_name="cat"),
        Fight(day=day, fight_url="y", first="bea", second="dee", winner="dee", stats={}, seconds=300.0, first_name="bea", second_name="dee"),
    ]
    both = build_dataset(history + todays, STATICS).set_index("fight_url")
    alone_x = build_dataset(history + todays[:1], STATICS).set_index("fight_url")
    alone_y = build_dataset(history + todays[1:], STATICS).set_index("fight_url")
    pd.testing.assert_series_equal(both.loc["x", FEATURE_COLUMNS].astype(float), alone_x.loc["x", FEATURE_COLUMNS].astype(float), check_names=False)
    pd.testing.assert_series_equal(both.loc["y", FEATURE_COLUMNS].astype(float), alone_y.loc["y", FEATURE_COLUMNS].astype(float), check_names=False)


def test_the_features_for_a_past_fight_equal_what_a_prediction_made_that_morning_would_use():
    """Train and serve share one code path: replay the history up to a day, then ask about the matchup."""
    fights = make_fights()
    dataset = build_dataset(fights, STATICS).set_index("fight_url")
    target = fights[len(fights) // 2]
    tracker = replay([f for f in fights if f.day < target.day])

    a_first = a_is_first(target.fight_url)
    a, b = (target.first, target.second) if a_first else (target.second, target.first)
    served = matchup_row(
        tracker.snapshot(a), STATICS[a], tracker.snapshot(b), STATICS[b], target.day,
        scheduled_rounds=target.scheduled_rounds, title_fight=target.title_fight, weight_class=target.weight_class,
    )
    pd.testing.assert_series_equal(pd.Series(served)[FEATURE_COLUMNS].astype(float), dataset.loc[target.fight_url, FEATURE_COLUMNS].astype(float), check_names=False)


# --------------------------------------------------------------------------- A and B


def test_who_is_a_depends_only_on_the_fight_and_is_a_fair_coin():
    urls = [f"http://ufcstats.com/fight-details/{i:08x}" for i in range(4000)]
    first = [a_is_first(u) for u in urls]
    assert first == [a_is_first(u) for u in urls]  # the same on every run
    assert 0.47 < np.mean(first) < 0.53


def test_the_label_is_balanced_even_though_the_source_lists_the_winner_first():
    fights = make_fights(300, seed=3)
    for f in fights:
        f.winner = f.first  # as in the real files: the winner comes first
    data = build_dataset(fights, STATICS)
    assert 0.4 < data["y"].mean() < 0.6


def test_swapping_the_fighters_negates_the_differences_and_keeps_the_rest():
    fights = make_fights()
    tracker = replay(fights[:20])
    on = date(2021, 1, 1)
    a, b = tracker.snapshot("ann"), tracker.snapshot("bea")
    forward = matchup_row(a, STATICS["ann"], b, STATICS["bea"], on, 3.0, 0.0, "Lightweight")
    backward = matchup_row(b, STATICS["bea"], a, STATICS["ann"], on, 3.0, 0.0, "Lightweight")
    for column in DIFF_FEATURES:
        if not math.isnan(forward[column]):
            assert forward[column] == pytest.approx(-backward[column])
    for column in set(FEATURE_COLUMNS) - set(DIFF_FEATURES):
        assert forward[column] == backward[column] or (math.isnan(forward[column]) and math.isnan(backward[column]))


def test_mirroring_twice_gives_the_original_back():
    data = build_dataset(make_fights(), STATICS)
    again = mirror(mirror(data))
    pd.testing.assert_frame_equal(again[FEATURE_COLUMNS + ["y"]], data[FEATURE_COLUMNS + ["y"]])
    assert (mirror(data)["y"] == 1 - data["y"]).all()


def test_a_probability_cannot_depend_on_the_order_of_the_fighters():
    # A model that always says "A wins at 100%" is pure corner bias; averaged over both orders it is a coin flip.
    biased = Pipeline([("classifier", DummyClassifier(strategy="constant", constant=1))])
    data = build_dataset(make_fights(), STATICS)
    biased.fit(data[FEATURE_COLUMNS].fillna(0), data["y"])
    assert np.allclose(train_prefight.symmetric_probability(biased, data.fillna(0)), 0.5)


# --------------------------------------------------------------------------- what the model may see


def test_no_calendar_or_corner_features_and_no_career_total_from_today():
    forbidden = ("year", "month", "red", "blue", "corner", "career", "now_", "date")
    assert [c for c in FEATURE_COLUMNS if any(word in c for word in forbidden)] == []


def test_a_few_strikes_do_not_make_a_perfect_striker():
    state = FighterState(stat_fights=1, minutes=1.0, sig_landed=5, sig_attempted=5, td_landed=1, td_attempted=1)
    f = fighter_features(state, Static(), date(2021, 1, 1))
    assert 0.45 < f["sig_acc"] < 0.5 and 0.35 < f["td_acc"] < 0.6
    assert f["sig_per_min"] < 6  # five strikes in one minute is not yet a 5-per-minute striker


def test_fight_length_comes_from_the_round_and_the_clock():
    assert fight_seconds("3.0", "4:30") == 2 * 300 + 4 * 60 + 30
    assert fight_seconds("", "") is None and fight_seconds("2", "oops") is None


def test_stats_are_only_used_when_both_fighters_have_them():
    cards = pd.DataFrame([{"event_date": "January 05, 2020", "fight_url": "u1", "fighter_1": "Ann", "fighter_2": "Bea", "winner": "Ann",
                           "method": "U-DEC", "round": "3", "time": "5:00", "weight_class": "Lightweight"}])
    details = pd.DataFrame([{"fight_url": "u1", "num_rounds": "3", "title_fight": "False"}])
    only_one = pd.DataFrame([{"fight_url": "u1", "fighter": "Ann", **{c: "1" for c in prefight.STAT_COLUMNS}}])
    both = pd.concat([only_one, pd.DataFrame([{"fight_url": "u1", "fighter": "Bea", **{c: "2" for c in prefight.STAT_COLUMNS}}])])
    assert prefight.load_fights(cards, details, only_one, {})[0].stats == {}
    assert set(prefight.load_fights(cards, details, both, {})[0].stats) == {"ann", "bea"}
    assert prefight.load_fights(cards, details, None, {})[0].stats == {}


# --------------------------------------------------------------------------- split and calibration


def test_the_split_is_by_date_and_never_cuts_an_event_in_two():
    data = build_dataset(make_fights(400, seed=5), STATICS)
    data["date"] = pd.to_datetime(data["date"]) + pd.to_timedelta(np.arange(len(data)) // 3, unit="D")  # three fights a day
    split = train_prefight.split_by_date(data)
    assert split.train["date"].max() < split.calibration["date"].min() <= split.calibration["date"].max() < split.test["date"].min()
    assert len(split.train) + len(split.calibration) + len(split.test) == len(data)
    for block_a, block_b in ((split.train, split.calibration), (split.calibration, split.test)):
        assert not set(block_a["date"]) & set(block_b["date"])


def test_calibration_keeps_the_answer_symmetric_and_fixes_under_confidence():
    p = np.array([0.1, 0.3, 0.5, 0.7, 0.9])
    assert np.allclose(train_prefight.calibrate(p, 1.0), p)
    assert train_prefight.calibrate(np.array([0.5]), 2.7)[0] == pytest.approx(0.5)
    assert np.allclose(train_prefight.calibrate(1 - p, 1.8), 1 - train_prefight.calibrate(p, 1.8))

    rng = np.random.default_rng(0)
    true_p = rng.uniform(0.05, 0.95, 4000)
    y = (rng.random(4000) < true_p).astype(int)
    timid = 1 / (1 + np.exp(-0.5 * np.log(true_p / (1 - true_p))))  # honest ranking, too little confidence
    assert train_prefight.fit_temperature(timid, y) > 1.5
    bold = 1 / (1 + np.exp(-2.0 * np.log(true_p / (1 - true_p))))
    assert train_prefight.fit_temperature(bold, y) < 0.7


# --------------------------------------------------------------------------- the repository's own data


def test_the_repository_data_builds_a_balanced_leak_free_dataset():
    data, fights, statics = prefight.build_from_repository()
    assert len(data) > 8000 and len(fights) > 8500
    assert 0.48 < data["y"].mean() < 0.52  # the source lists the winner first 99.9% of the time
    assert data["y"].isin([0, 1]).all() and data["date"].is_monotonic_increasing
    assert set(FEATURE_COLUMNS) <= set(data.columns)
    first = data.groupby("fight_url").size()
    assert first.max() == 1


def test_a_fight_whose_numbers_contradict_themselves_gives_no_statistics():
    cards = pd.DataFrame([{"event_date": "January 05, 2020", "fight_url": "u1", "fighter_1": "Ann", "fighter_2": "Bea", "winner": "Ann",
                           "method": "U-DEC", "round": "3", "time": "5:00", "weight_class": "Lightweight"}])
    details = pd.DataFrame([{"fight_url": "u1", "num_rounds": "3", "title_fight": "False"}])
    sane = {c: "5" for c in prefight.STAT_COLUMNS}
    broken = {**sane, "sig_landed": "13", "sig_attempted": "0"}  # ESPN: 13 landed, none attempted
    rows = lambda a, b: pd.DataFrame([{"fight_url": "u1", "fighter": "Ann", **a}, {"fight_url": "u1", "fighter": "Bea", **b}])  # noqa: E731
    assert set(prefight.load_fights(cards, details, rows(sane, sane), {})[0].stats) == {"ann", "bea"}
    assert prefight.load_fights(cards, details, rows(sane, broken), {})[0].stats == {}
