"""Train a winner model on features known before each fight, with an honest test.

    python -m src.ufc_predictor.train_prefight

One command, nothing from outside the repository. It reads the CSV files in data/raw (see prefight.py), rebuilds every
fight as it looked before the bell, and writes:

    models/candidate/ufc_prefight_model.joblib    the candidate model; the deployed model is not touched
    docs/prefight-model-report.md                 data, split, results and calibration

How the data is cut. Fights are split by date, never by row position or at random:
    train        the oldest 65% of the fights (cut on a day, so one event is never split)
    calibration  the next 15%: picks the model settings and fits the one calibration number
    test         the newest 20%: looked at once, at the end

Fighter A and B are drawn at random per fight (prefight.a_is_first), the training rows are also shown mirrored, and a
probability is always the average of both orders, so the answer cannot depend on who is called A.
"""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from scipy.optimize import minimize_scalar
from sklearn.dummy import DummyClassifier
from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, brier_score_loss, log_loss, roc_auc_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from .config import BASE_DIR, MODEL_DIR
from .prefight import FEATURE_COLUMNS, build_from_repository, mirror

SEED = 42
TRAIN_END_QUANTILE = 0.65
CALIBRATION_END_QUANTILE = 0.80
CANDIDATE_PATH = MODEL_DIR / "candidate" / "ufc_prefight_model.joblib"
REPORT_PATH = BASE_DIR / "docs" / "prefight-model-report.md"
CONFIDENCE_BANDS = [(0.5, 0.55), (0.55, 0.6), (0.6, 0.65), (0.65, 0.7), (0.7, 0.8), (0.8, 0.9), (0.9, 1.0001)]

# Settings tried on the calibration block; the one with the lowest log loss there is used. (max_depth, learning_rate, max_iter, l2)
HGB_SETTINGS = [(2, 0.05, 200, 5.0), (3, 0.05, 200, 5.0), (3, 0.03, 300, 10.0), (4, 0.03, 300, 10.0), (4, 0.02, 400, 20.0)]


# --------------------------------------------------------------------------- split


@dataclass
class Split:
    train: pd.DataFrame
    calibration: pd.DataFrame
    test: pd.DataFrame
    train_end: pd.Timestamp
    calibration_end: pd.Timestamp


def split_by_date(data: pd.DataFrame) -> Split:
    train_end = data["date"].quantile(TRAIN_END_QUANTILE)
    calibration_end = data["date"].quantile(CALIBRATION_END_QUANTILE)
    return Split(
        train=data[data["date"] < train_end],
        calibration=data[(data["date"] >= train_end) & (data["date"] < calibration_end)],
        test=data[data["date"] >= calibration_end],
        train_end=train_end,
        calibration_end=calibration_end,
    )


# --------------------------------------------------------------------------- models, symmetric probabilities, calibration


def hgb_pipeline(depth: int, learning_rate: float, iterations: int, l2: float) -> Pipeline:
    # The step names match what the API reads from a model file (imputer, classifier).
    return Pipeline([
        ("imputer", SimpleImputer(strategy="median", keep_empty_features=True)),
        ("classifier", HistGradientBoostingClassifier(
            max_depth=depth, learning_rate=learning_rate, max_iter=iterations, l2_regularization=l2, random_state=SEED)),
    ])


def baselines() -> dict[str, Pipeline]:
    imputer = lambda: SimpleImputer(strategy="median", keep_empty_features=True)  # noqa: E731
    return {
        "dummy_prior": Pipeline([("imputer", imputer()), ("classifier", DummyClassifier(strategy="prior"))]),
        "logistic_regression": Pipeline([("imputer", imputer()), ("scaler", StandardScaler()),
                                         ("classifier", LogisticRegression(max_iter=3000, C=0.3, random_state=SEED))]),
        "random_forest": Pipeline([("imputer", imputer()), ("classifier", RandomForestClassifier(
            n_estimators=400, min_samples_leaf=20, random_state=SEED, n_jobs=-1))]),
    }


def fit(model: Pipeline, train: pd.DataFrame) -> Pipeline:
    shown = pd.concat([train, mirror(train)], ignore_index=True)  # every fight from both fighters' side
    return model.fit(shown[FEATURE_COLUMNS], shown["y"])


def symmetric_probability(model: Pipeline, frame: pd.DataFrame) -> np.ndarray:
    """P(A wins), averaged over the two orders so that p(A, B) + p(B, A) = 1 exactly."""
    forward = model.predict_proba(frame[FEATURE_COLUMNS])[:, 1]
    backward = model.predict_proba(mirror(frame.assign(y=0))[FEATURE_COLUMNS])[:, 1]
    return (forward + 1.0 - backward) / 2.0


def logit(p: np.ndarray) -> np.ndarray:
    p = np.clip(p, 1e-6, 1 - 1e-6)
    return np.log(p / (1 - p))


def calibrate(p: np.ndarray, temperature: float) -> np.ndarray:
    """Stretch (temperature > 1) or soften (< 1) the confidence. One number and no intercept, so 0.5 stays 0.5 and
    calibrate(1 - p) = 1 - calibrate(p): the answer still does not depend on the order of the fighters."""
    return 1.0 / (1.0 + np.exp(-temperature * logit(p)))


def fit_temperature(p: np.ndarray, y: np.ndarray) -> float:
    result = minimize_scalar(lambda t: log_loss(y, np.clip(calibrate(p, t), 1e-6, 1 - 1e-6)), bounds=(0.2, 5.0), method="bounded")
    return float(result.x)


# --------------------------------------------------------------------------- metrics


def expected_calibration_error(p: np.ndarray, y: np.ndarray, bins: int = 10) -> float:
    edges = np.linspace(0, 1, bins + 1)
    index = np.clip(np.digitize(p, edges[1:-1]), 0, bins - 1)
    return float(sum(abs(y[index == b].mean() - p[index == b].mean()) * (index == b).mean() for b in range(bins) if (index == b).any()))


def metrics(p: np.ndarray, y: np.ndarray) -> dict[str, float]:
    return {
        "accuracy": float(accuracy_score(y, p >= 0.5)),
        "roc_auc": float(roc_auc_score(y, p)),
        "log_loss": float(log_loss(y, np.clip(p, 1e-6, 1 - 1e-6))),
        "brier": float(brier_score_loss(y, p)),
        "ece": expected_calibration_error(p, y),
    }


def confidence_table(p: np.ndarray, y: np.ndarray) -> pd.DataFrame:
    confidence = np.maximum(p, 1 - p)
    right = (p >= 0.5) == (y == 1)
    rows = []
    for low, high in CONFIDENCE_BANDS:
        inside = (confidence >= low) & (confidence < high)
        if inside.any():
            rows.append({"band": f"{low:.0%}-{min(high, 1):.0%}", "fights": int(inside.sum()),
                         "average_confidence": float(confidence[inside].mean()), "hit_rate": float(right[inside].mean())})
    return pd.DataFrame(rows)


# --------------------------------------------------------------------------- the run


@dataclass
class Result:
    split: Split
    model: Pipeline
    settings: tuple
    temperature: float
    test_metrics: dict[str, dict[str, float]]
    selection: list[dict]
    bands: pd.DataFrame
    probabilities: np.ndarray


def run(data: pd.DataFrame) -> Result:
    split = split_by_date(data)
    y_cal, y_test = split.calibration["y"].to_numpy(), split.test["y"].to_numpy()

    # 1) pick the model settings on the calibration block (never on the test block)
    selection = []
    for settings in HGB_SETTINGS:
        trial = fit(hgb_pipeline(*settings), split.train)
        p = symmetric_probability(trial, split.calibration)
        selection.append({"settings": settings, "calibration_log_loss": float(log_loss(y_cal, np.clip(p, 1e-6, 1 - 1e-6)))})
    best = min(selection, key=lambda row: row["calibration_log_loss"])["settings"]

    # 2) the chosen model, and the one calibration number fitted on the calibration block
    model = fit(hgb_pipeline(*best), split.train)
    temperature = fit_temperature(symmetric_probability(model, split.calibration), y_cal)

    # 3) the test block, once
    raw = symmetric_probability(model, split.test)
    calibrated = calibrate(raw, temperature)
    results = {"hist_gradient_boosting_calibrated": metrics(calibrated, y_test), "hist_gradient_boosting_raw": metrics(raw, y_test)}
    for name, baseline in baselines().items():
        results[name] = metrics(symmetric_probability(fit(baseline, split.train), split.test), y_test)
    return Result(split, model, best, temperature, results, selection, confidence_table(calibrated, y_test), calibrated)


def save_candidate(result: Result, data: pd.DataFrame, path: Path = CANDIDATE_PATH) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump({
        "model": result.model,
        "feature_columns": FEATURE_COLUMNS,
        "metrics": result.test_metrics["hist_gradient_boosting_calibrated"],
        "baseline_metrics": {k: v for k, v in result.test_metrics.items() if not k.startswith("hist_gradient_boosting")},
        "shap_background": result.split.train[FEATURE_COLUMNS].sample(min(80, len(result.split.train)), random_state=SEED),
        "calibration": {"method": "temperature", "temperature": result.temperature},
        "settings": result.settings,
        "trained_on_fights_before": str(result.split.train_end.date()),
        "version": "prefight-1",
    }, path)


def render_report(result: Result, data: pd.DataFrame, fights_total: int) -> str:
    s = result.split
    stats_share = float(data[["sig_acc_diff"]].notna().mean().iloc[0])
    test_stats_share = float(s.test["sig_acc_diff"].notna().mean())
    names = {
        "dummy_prior": "Always 50/50", "logistic_regression": "Logistic regression", "random_forest": "Random forest",
        "hist_gradient_boosting_raw": "Gradient boosting (before calibration)", "hist_gradient_boosting_calibrated": "**Gradient boosting, calibrated (candidate)**",
    }
    order = ["dummy_prior", "logistic_regression", "random_forest", "hist_gradient_boosting_raw", "hist_gradient_boosting_calibrated"]
    lines = [
        "# Prefight model: training report", "",
        "Generated by `python -m src.ufc_predictor.train_prefight`. Every fight is described by what was known before it; the deployed model is not touched.", "",
        "## Data", "",
        f"- {fights_total:,} past fights in `event_cards.csv`; {len(data):,} have a winner and both fighters identified, and are used.",
        f"- {stats_share:.0%} of those fights have striking and takedown history for both fighters from earlier fights ({test_stats_share:.0%} of the test fights).",
        f"- Fighter A and B are drawn at random per fight (share of fights where A won: {data['y'].mean():.1%}).",
        "- No year or month feature, no corner, no career total from today.", "",
        "## Split by date", "",
        "| Block | Fights | From | To |", "| --- | --- | --- | --- |",
        f"| Train | {len(s.train):,} | {s.train['date'].min().date()} | {s.train['date'].max().date()} |",
        f"| Calibration | {len(s.calibration):,} | {s.calibration['date'].min().date()} | {s.calibration['date'].max().date()} |",
        f"| Test | {len(s.test):,} | {s.test['date'].min().date()} | {s.test['date'].max().date()} |", "",
        "Every test fight is later than every training fight. The model settings and the calibration number were chosen on the calibration block, never on the test block.", "",
        "## Results on the test block", "",
        "| Model | Accuracy | ROC AUC | Log loss | Brier | Calibration error |", "| --- | --- | --- | --- | --- | --- |",
    ]
    for key in order:
        m = result.test_metrics[key]
        lines.append(f"| {names[key]} | {m['accuracy']:.1%} | {m['roc_auc']:.3f} | {m['log_loss']:.3f} | {m['brier']:.3f} | {m['ece']:.3f} |")
    lines += [
        "", "Probabilities are averaged over both fighter orders, so the answer does not depend on who is called A. "
        f"Calibration is one number (temperature {result.temperature:.2f}) fitted on the calibration block.", "",
        "## Calibration of the candidate on the test block", "",
        "| Confidence | Fights | Average confidence | Right |", "| --- | --- | --- | --- |",
    ]
    for row in result.bands.itertuples():
        lines.append(f"| {row.band} | {row.fights} | {row.average_confidence:.1%} | {row.hit_rate:.1%} |")
    lines += [
        "", "## Settings tried on the calibration block", "", "| max depth | learning rate | iterations | L2 | Log loss |", "| --- | --- | --- | --- | --- |",
    ]
    for row in result.selection:
        d, lr, it, l2 = row["settings"]
        chosen = " (chosen)" if row["settings"] == result.settings else ""
        lines.append(f"| {d} | {lr} | {it} | {l2} | {row['calibration_log_loss']:.4f}{chosen} |")
    lines += ["", "## Features", "", f"{len(FEATURE_COLUMNS)} features: " + ", ".join(f"`{c}`" for c in FEATURE_COLUMNS) + ".", ""]
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--no-write", action="store_true", help="train and print the report, write no files")
    args = parser.parse_args(argv)

    data, fights, _ = build_from_repository()
    result = run(data)
    report = render_report(result, data, len(fights))
    print(report)
    if args.no_write:
        return
    save_candidate(result, data)
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(report + "\n", encoding="utf-8")
    print(json.dumps({"candidate": str(CANDIDATE_PATH), "report": str(REPORT_PATH)}))


if __name__ == "__main__":
    main()
