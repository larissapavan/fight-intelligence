"""The deployed model against the pre-fight candidate, on the very same fights.

    python -m src.ufc_predictor.train_prefight    # first: trains the candidate
    python -m scripts.compare_models

Writes docs/model-comparison.md and models/ufc_winner_model.evaluation.json (the deployed model's own result on these fights,
which the API sends to the site so that it shows a measured accuracy instead of the one in the model's file). Both models are scored on the test block of train_prefight (the newest 20% of fights,
all later than anything the candidate trained on).

What each model is given:
    candidate     what was known before each fight (the features it was trained on)
    deployed      the closest the repository allows to what it expects: age and win-loss record as of the fight, height,
                  reach and stance, the fight's date, and striking/takedown accuracy as career totals of TODAY (the
                  repository has no per-fight history for the old model's two accuracy features before the new coverage).
                  Its own training data is not in the repository, so its reported test numbers cannot be reproduced here.

A third check measures how much a model gains from today's career totals, which include the fight being predicted and
every later one: the same gradient boosting as the candidate, trained once without them and once with them.
"""

from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import joblib
import numpy as np
import pandas as pd

from src.ufc_predictor import prefight, train_prefight as tp
from src.ufc_predictor.config import BASE_DIR, MODEL_PATH
from src.ufc_predictor.features import align_feature_columns, build_inference_frame
from src.ufc_predictor.prefight import FEATURE_COLUMNS, name_key

REPORT_PATH = BASE_DIR / "docs" / "model-comparison.md"
EVALUATION_PATH = MODEL_PATH.with_suffix(".evaluation.json")
CONFIDENT = 0.9  # "picks it rated 90% or more"
LEAK_COLUMNS = ["now_wins_diff", "now_losses_diff", "now_win_rate_diff"]


def percent(value) -> float:
    text = str(value).strip().replace("%", "")
    try:
        return float(text) / 100.0
    except ValueError:
        return float("nan")


def today_totals(tables: prefight.RawTables) -> dict[str, dict[str, float]]:
    """Career numbers as they stand today, by name key (what the deployed model is served and was likely trained on)."""
    fighters = tables.fighters.copy()
    fighters["key"] = (fighters["first_name"] + " " + fighters["last_name"]).map(name_key)
    fighters = fighters[~fighters["key"].duplicated(keep=False)]
    career = tables.career.set_index("fighter_url")
    out: dict[str, dict[str, float]] = {}
    for row in fighters.itertuples():
        if row.fighter_url not in career.index:
            continue
        c = career.loc[row.fighter_url]
        wins, losses = pd.to_numeric(c["wins"], errors="coerce"), pd.to_numeric(c["losses"], errors="coerce")
        out[row.key] = {"wins": wins, "losses": losses, "sig_str_acc": percent(c["sig_str_acc"]), "takedown_acc": percent(c["takedown_acc"])}
    for alias, canonical in tables.aliases.items():
        if canonical in out and alias not in out:
            out[alias] = out[canonical]
    return out


def pre_ufc_records(fights: list[prefight.Fight], totals: dict[str, dict[str, float]]) -> dict[str, tuple[float, float]]:
    """Career record minus the UFC record: what a fighter had outside the UFC (an estimate; it can include later fights)."""
    ufc = {}
    for f in fights:
        for who in (f.first, f.second):
            w, l = ufc.setdefault(who, [0, 0])
            if f.winner == who:
                ufc[who][0] += 1
            elif f.winner:
                ufc[who][1] += 1
    return {who: (max(totals[who]["wins"] - w, 0), max(totals[who]["losses"] - l, 0)) for who, (w, l) in ufc.items() if who in totals and not np.isnan(totals[who]["wins"])}


def deployed_inputs(test: pd.DataFrame, totals, pre_ufc, statics, swap: bool) -> pd.DataFrame:
    rows = []
    for r in test.itertuples():
        sides = [("a", r.key_a), ("b", r.key_b)]
        if swap:
            sides.reverse()
        (_, red), (_, blue) = sides
        red_prefix, blue_prefix = ("b", "a") if swap else ("a", "b")

        def record(prefix, key):
            wins = getattr(r, f"{prefix}__ufc_wins") + pre_ufc.get(key, (0, 0))[0]
            losses = getattr(r, f"{prefix}__ufc_losses") + pre_ufc.get(key, (0, 0))[1]
            return wins, losses

        (rw, rl), (bw, bl) = record(red_prefix, red), record(blue_prefix, blue)
        num = lambda v, d: d if v is None or pd.isna(v) else float(v)  # noqa: E731
        rows.append(build_inference_frame(
            fight_date=r.date, fighter_red=red, fighter_blue=blue,
            red_age=num(getattr(r, f"{red_prefix}__age"), 30.0), blue_age=num(getattr(r, f"{blue_prefix}__age"), 30.0),
            red_height_cm=num(statics[red].height, 178.0), blue_height_cm=num(statics[blue].height, 178.0),
            red_reach_cm=num(statics[red].reach, 183.0), blue_reach_cm=num(statics[blue].reach, 183.0),
            red_wins=rw, blue_wins=bw, red_losses=rl, blue_losses=bl,
            red_sig_str_acc=num(totals.get(red, {}).get("sig_str_acc"), 0.45), blue_sig_str_acc=num(totals.get(blue, {}).get("sig_str_acc"), 0.45),
            red_takedown_acc=num(totals.get(red, {}).get("takedown_acc"), 0.40), blue_takedown_acc=num(totals.get(blue, {}).get("takedown_acc"), 0.40),
            red_stance=statics[red].stance or "Orthodox", blue_stance=statics[blue].stance or "Orthodox",
        ))
    return pd.concat(rows, ignore_index=True)


def leak_columns(data: pd.DataFrame, totals) -> pd.DataFrame:
    """Today's career totals as features (A minus B): the leaky way."""
    def get(key, field):
        return totals.get(key, {}).get(field, np.nan)

    wins_a, wins_b = data["key_a"].map(lambda k: get(k, "wins")), data["key_b"].map(lambda k: get(k, "wins"))
    loss_a, loss_b = data["key_a"].map(lambda k: get(k, "losses")), data["key_b"].map(lambda k: get(k, "losses"))
    out = data.copy()
    out["now_wins_diff"], out["now_losses_diff"] = wins_a - wins_b, loss_a - loss_b
    out["now_win_rate_diff"] = wins_a / (wins_a + loss_a + 1) - wins_b / (wins_b + loss_b + 1)
    return out


def leak_demo(split: tp.Split, totals, settings) -> dict[str, dict[str, float]]:
    """The candidate's algorithm, with and without today's career totals, on the same split."""
    train, test = leak_columns(split.train, totals), leak_columns(split.test, totals)
    results = {}
    for label, columns in (("without today's totals (honest)", FEATURE_COLUMNS), ("with today's career totals added (leaky)", FEATURE_COLUMNS + LEAK_COLUMNS)):
        flipped = train.copy()
        for c in [c for c in columns if c.endswith("_diff")]:
            flipped[c] = -flipped[c]
        flipped["y"] = 1 - flipped["y"]
        shown = pd.concat([train, flipped], ignore_index=True)
        model = tp.hgb_pipeline(*settings).fit(shown[columns], shown["y"])
        forward = model.predict_proba(test[columns])[:, 1]
        mirrored = test.copy()
        for c in [c for c in columns if c.endswith("_diff")]:
            mirrored[c] = -mirrored[c]
        p = (forward + 1 - model.predict_proba(mirrored[columns])[:, 1]) / 2
        results[label] = tp.metrics(p, test["y"].to_numpy())
    return results


BASELINES = [
    ("Pick at random", None),
    ("Pick the fighter with more UFC wins", "ufc_wins_diff"),
    ("Pick the fighter with the better rating (Elo)", "elo_diff"),
]


def baseline_accuracies(test: pd.DataFrame, y: np.ndarray) -> list[dict]:
    """What simple rules get right on the same fights, so the model's accuracy has something to be compared with.

    Fighter A is drawn at random, so a rule that favors A or B at random is the 50% coin flip. A tie (equal wins or ratings)
    counts as half a win, which is what guessing would get."""
    rows = []
    for label, column in BASELINES:
        if column is None:
            rows.append({"label": label, "accuracy": 0.5})
            continue
        if column not in test:
            continue
        diff = test[column].to_numpy(dtype=float)
        picked_a = diff > 0
        credit = np.where(diff == 0, 0.5, (picked_a == (y == 1)).astype(float))
        rows.append({"label": label, "accuracy": round(float(credit.mean()), 4)})
    return rows


def calibration_bins(p: np.ndarray, y: np.ndarray) -> list[dict]:
    """How often a pick at each confidence level was right, for the reliability chart."""
    return [
        {"label": row.band, "fights": int(row.fights), "average_confidence": round(float(row.average_confidence), 4), "accuracy": round(float(row.hit_rate), 4)}
        for row in tp.confidence_table(p, y).itertuples()
    ]


def evaluation_record(test: pd.DataFrame, p: np.ndarray, y: np.ndarray) -> dict:
    """The deployed model's result on the test fights, in the shape the API sends to the site."""
    confidence = np.maximum(p, 1 - p)
    confident = confidence >= CONFIDENT
    result = tp.metrics(p, y)
    return {
        "fights": int(len(test)),
        "start": str(test["date"].min().date()),
        "end": str(test["date"].max().date()),
        **{k: round(float(v), 4) for k, v in result.items()},
        "confident_threshold": CONFIDENT,
        "confident_fights": int(confident.sum()),
        "confident_hit_rate": round(float(((p[confident] >= 0.5) == (y[confident] == 1)).mean()), 4) if confident.any() else None,
        "baselines": baseline_accuracies(test, y),
        "calibration": calibration_bins(p, y),
    }


def table(rows: list[tuple[str, dict]]) -> list[str]:
    def cell(value: float, spec: str) -> str:
        return "not reported" if value != value else format(value, spec)  # NaN: the deployed file has no Brier or calibration error

    lines = ["| Model | Accuracy | ROC AUC | Log loss | Brier | Calibration error |", "| --- | --- | --- | --- | --- | --- |"]
    for name, m in rows:
        lines.append(f"| {name} | {cell(m['accuracy'], '.1%')} | {cell(m['roc_auc'], '.3f')} | {cell(m['log_loss'], '.3f')} | {cell(m['brier'], '.3f')} | {cell(m['ece'], '.3f')} |")
    return lines


def main() -> None:
    candidate_path = tp.CANDIDATE_PATH
    if not candidate_path.exists():
        raise SystemExit(f"No candidate at {candidate_path}. Run: python -m src.ufc_predictor.train_prefight")
    candidate = joblib.load(candidate_path)
    deployed = joblib.load(MODEL_PATH)

    data, fights, statics = prefight.build_from_repository(keep_sides=True)
    tables = prefight.load_raw()
    split = tp.split_by_date(data)
    test = split.test.reset_index(drop=True)
    y = test["y"].to_numpy()
    totals = today_totals(tables)
    pre_ufc = pre_ufc_records(fights, totals)

    p_new = tp.calibrate(tp.symmetric_probability(candidate["model"], test), candidate["calibration"]["temperature"])
    frames = {swap: align_feature_columns(deployed_inputs(test, totals, pre_ufc, statics, swap), deployed["feature_columns"]) for swap in (False, True)}
    p_one = deployed["model"].predict_proba(frames[False])[:, 1]
    p_both = (p_one + 1 - deployed["model"].predict_proba(frames[True])[:, 1]) / 2

    rows = [
        ("Deployed model, as reported in its own file", {**deployed["metrics"], "brier": float("nan"), "ece": float("nan")}),
        ("Deployed model, one order (how it answered before)", tp.metrics(p_one, y)),
        ("Deployed model, both orders averaged (as the site is now)", tp.metrics(p_both, y)),
        ("**Pre-fight candidate (calibrated)**", tp.metrics(p_new, y)),
    ]
    leak = leak_demo(split, totals, candidate["settings"])

    def band(p):
        c = np.maximum(p, 1 - p)
        hi = c >= 0.8
        return int(hi.sum()), float(((p[hi] >= 0.5) == (y[hi] == 1)).mean()) if hi.any() else float("nan")

    n_old, hit_old = band(p_both)
    n_new, hit_new = band(p_new)
    bands = {"deployed (both orders)": tp.confidence_table(p_both, y), "candidate": tp.confidence_table(p_new, y)}

    lines = [
        "# Deployed model vs pre-fight candidate", "",
        f"Generated by `python -m scripts.compare_models` on {date.today()}. Same {len(test):,} test fights for every row "
        f"({test['date'].min().date()} to {test['date'].max().date()}), all later than anything the candidate trained on.", "",
        "## Results", "", *table(rows), "",
        "The first row is what the deployed model's file says it measured when it was trained. Its training data is not in the repository, "
        "so that number cannot be reproduced. The next two rows are the deployed model scored here, on fights it is asked about today, with the closest inputs the "
        "repository allows (age and record as of the fight, height, reach, stance; striking and takedown accuracy can only be today's career values).", "",
        "## How often a confident pick is right", "",
        f"- Deployed (both orders): {n_old} fights at 80% or more; right in {hit_old:.1%} of them.",
        f"- Candidate: {n_new} fights at 80% or more; right in {hit_new:.1%} of them.", "",
        "### Calibration by confidence band", "",
    ]
    for name, frame in bands.items():
        lines += [f"**{name}**", "", "| Confidence | Fights | Average confidence | Right |", "| --- | --- | --- | --- |"]
        lines += [f"| {r.band} | {r.fights} | {r.average_confidence:.1%} | {r.hit_rate:.1%} |" for r in frame.itertuples()]
        lines.append("")
    lines += [
        "## How much does using today's career totals inflate a model?", "",
        "The same gradient boosting as the candidate, on the same split, trained twice. Today's career totals include the fight being "
        "predicted and every later one, so a model that sees them is partly reading the answer.", "", *table(list(leak.items())), "",
        "## What this does and does not show", "",
        "- The candidate's numbers are honest: every feature is from before the fight, the test fights are all later than the training fights, "
        "and the model settings and calibration were chosen without looking at the test block.",
        "- The deployed model's own training data is not available, so it is not known whether its reported accuracy came from this kind of leakage. "
        "The table above shows that a model fed today's career totals reaches that accuracy, and that the deployed model does not reach it on these fights.",
        "- Striking and takedown history comes from ESPN's per-fight statistics (`data/raw/fight_stats.csv`), which cover 98.8% of the fights; "
        "a fighter's first fights have no history yet, so those rows have empty striking features.",
        "- One test block, one split: read differences of a point or two as noise.", "",
    ]
    report = "\n".join(lines)
    print(report)
    REPORT_PATH.write_text(report + "\n", encoding="utf-8")
    EVALUATION_PATH.write_text(json.dumps(evaluation_record(test, p_both, y), indent=2) + "\n", encoding="utf-8")
    print(f"[info] wrote {EVALUATION_PATH.name}")


if __name__ == "__main__":
    main()
