import pandas as pd

from src.ufc_predictor.features import align_feature_columns, build_features, get_feature_columns


def _sample_frame() -> pd.DataFrame:
    return pd.DataFrame(
        [
            {
                "fight_date": "2024-05-01",
                "fighter_red": "Red Fighter",
                "fighter_blue": "Blue Fighter",
                "winner": "red",
                "age": 30,
                "red_age": 28.0,
                "blue_age": 32.0,
                "height_cm": 0,
                "red_height_cm": 180.0,
                "blue_height_cm": 175.0,
                "reach_cm": 0,
                "red_reach_cm": 185.0,
                "blue_reach_cm": 178.0,
                "wins": 0,
                "red_wins": 10,
                "blue_wins": 8,
                "losses": 0,
                "red_losses": 2,
                "blue_losses": 4,
                "sig_str_acc": 0,
                "red_sig_str_acc": 0.5,
                "blue_sig_str_acc": 0.4,
                "takedown_acc": 0,
                "red_takedown_acc": 0.6,
                "blue_takedown_acc": 0.3,
                "red_stance": "Orthodox",
                "blue_stance": "Southpaw",
            }
        ]
    )


def test_build_features_computes_diffs_and_sums():
    enriched = build_features(_sample_frame())

    assert enriched.loc[0, "age_diff"] == 28.0 - 32.0
    assert enriched.loc[0, "age_sum"] == 28.0 + 32.0
    assert enriched.loc[0, "reach_cm_diff"] == 185.0 - 178.0


def test_build_features_computes_win_rate_diff():
    enriched = build_features(_sample_frame())

    red_win_rate = 10 / (10 + 2 + 1)
    blue_win_rate = 8 / (8 + 4 + 1)
    assert abs(enriched.loc[0, "red_win_rate"] - red_win_rate) < 1e-9
    assert abs(enriched.loc[0, "blue_win_rate"] - blue_win_rate) < 1e-9
    assert abs(enriched.loc[0, "win_rate_diff"] - (red_win_rate - blue_win_rate)) < 1e-9


def test_build_features_flags_different_stances():
    enriched = build_features(_sample_frame())
    assert enriched.loc[0, "same_stance"] == 0


def test_build_features_flags_same_stance():
    frame = _sample_frame()
    frame["blue_stance"] = "Orthodox"
    enriched = build_features(frame)
    assert enriched.loc[0, "same_stance"] == 1


def test_get_feature_columns_excludes_identifiers_and_target():
    enriched = build_features(_sample_frame())
    columns = get_feature_columns(enriched)

    for excluded in ("fight_date", "fighter_red", "fighter_blue", "winner", "red_stance", "blue_stance"):
        assert excluded not in columns


def test_align_feature_columns_fills_missing_and_orders_output():
    frame = pd.DataFrame([{"a": 1, "b": 2}])
    aligned = align_feature_columns(frame, ["b", "c", "a"])

    assert list(aligned.columns) == ["b", "c", "a"]
    assert aligned.loc[0, "c"] == 0
    assert aligned.loc[0, "a"] == 1
