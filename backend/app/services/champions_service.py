from __future__ import annotations

from datetime import date, datetime

import pandas as pd

from src.ufc_predictor.config import RAW_DATA_DIR

TITLE_REIGNS_SOURCE_PATH = RAW_DATA_DIR / "title_reigns.csv"

TOP_N_GREATEST_CHAMPIONS = 15
TOP_N_PER_RECORD = 10


def _source_signature() -> tuple:
    return (TITLE_REIGNS_SOURCE_PATH.stat().st_mtime_ns if TITLE_REIGNS_SOURCE_PATH.exists() else None,)


_cache: dict = {"signature": None, "data": None}


def get_champions_data() -> dict:
    """Title-fight history (reigns, defenses, records), sourced from
    data/raw/title_reigns.csv (compiled from published UFC title histories).
    Rebuilds automatically when the source CSV changes."""

    signature = _source_signature()
    if _cache["signature"] != signature:
        _cache["data"] = _build_champions_data()
        _cache["signature"] = signature
    return _cache["data"]


def _load_reigns_df() -> pd.DataFrame:
    if not TITLE_REIGNS_SOURCE_PATH.exists():
        return pd.DataFrame()

    df = pd.read_csv(TITLE_REIGNS_SOURCE_PATH, keep_default_na=False, na_values=[""])
    df["days_held"] = pd.to_numeric(df["days_held"], errors="coerce")
    df["is_current"] = df["is_current"].astype(str).str.lower().eq("true")

    today = pd.Timestamp(date.today())
    date_won = pd.to_datetime(df["date_won"], errors="coerce")
    current_days = (today - date_won).dt.days
    df["days_held_effective"] = df["days_held"].where(~df["is_current"], current_days)

    df = df.sort_values("date_won").reset_index(drop=True)
    return df


def _build_champions_data() -> dict:
    df = _load_reigns_df()
    if df.empty:
        return {"current_champions": [], "greatest_champions": [], "records": []}

    current_champions = [_reign_to_dict(row) for row in df[df["is_current"]].to_dict(orient="records")]
    current_champions.sort(key=lambda r: r["division"])

    greatest_champions = _build_greatest_champions(df)
    records = _build_records(df)

    return {
        "current_champions": current_champions,
        "greatest_champions": greatest_champions,
        "records": records,
    }


def _reign_to_dict(row: dict) -> dict:
    return {
        "division": row["division"],
        "title_type": row["title_type"],
        "champion": row["champion"],
        "fighter_url": _nullable_string(row.get("fighter_url")),
        "fighter_reign_index": int(row["fighter_reign_index"]),
        "won_how": _nullable_string(row.get("won_how")),
        "opponent_beaten": _nullable_string(row.get("opponent_beaten")),
        "event": _nullable_string(row.get("event")),
        "location": _nullable_string(row.get("location")),
        "date_won": _nullable_string(row.get("date_won")),
        "days_held": _nullable_int(row.get("days_held_effective", row.get("days_held"))),
        "is_current": bool(row["is_current"]),
        "defenses_count": int(row["defenses_count"]),
        "defenses_detail": _nullable_string(row.get("defenses_detail")),
        "end_reason": row["end_reason"],
    }


def _build_greatest_champions(df: pd.DataFrame) -> list[dict]:
    grouped = df.groupby("champion")
    summaries = []
    for champion, group in grouped:
        fighter_url = next((u for u in group["fighter_url"] if isinstance(u, str) and u), None)
        divisions = sorted(group["division"].unique().tolist())
        total_defenses = int(group["defenses_count"].sum())
        total_days = int(group["days_held_effective"].fillna(0).sum())
        longest_reign = int(group["days_held_effective"].fillna(0).max())
        is_current = bool(group["is_current"].any())
        summaries.append(
            {
                "champion": champion,
                "fighter_url": fighter_url,
                "divisions": divisions,
                "total_reigns": len(group),
                "total_defenses": total_defenses,
                "total_days_as_champion": total_days,
                "longest_reign_days": longest_reign,
                "is_current_champion": is_current,
            }
        )

    summaries.sort(key=lambda s: -s["total_days_as_champion"])
    return summaries[:TOP_N_GREATEST_CHAMPIONS]


def _build_records(df: pd.DataFrame) -> list[dict]:
    records = [
        _record_from_reigns(
            df,
            key="most_defenses_single_reign",
            label="Most defenses in a single reign",
            kind="positive",
            unit="defenses",
            sort_column="defenses_count",
            value_column="defenses_count",
        ),
        _record_from_reigns(
            df,
            key="longest_reign",
            label="Longest reign",
            kind="positive",
            unit="days",
            sort_column="days_held_effective",
            value_column="days_held_effective",
        ),
        _record_by_champion(
            df,
            key="most_cumulative_defenses",
            label="Most career title defenses",
            kind="positive",
            unit="defenses",
            agg_column="defenses_count",
            agg="sum",
        ),
        _record_by_champion(
            df,
            key="most_title_reigns",
            label="Most times becoming champion",
            kind="positive",
            unit="reigns",
            agg_column=None,
            agg="count",
        ),
        _multi_division_record(df),
        _record_from_reigns(
            df[(df["title_type"] == "undisputed") & df["days_held"].notna()],
            key="shortest_reign",
            label="Shortest reign",
            kind="negative",
            unit="days",
            sort_column="days_held",
            value_column="days_held",
            ascending=True,
        ),
        _record_by_champion(
            df,
            key="most_times_stripped",
            label="Most titles lost outside the cage (stripped)",
            kind="negative",
            unit="times",
            agg_column="end_reason",
            agg="count_stripped",
        ),
        _record_by_champion(
            df,
            key="most_title_losses",
            label="Most times losing the title",
            kind="negative",
            unit="times",
            agg_column="end_reason",
            agg="count_lost",
        ),
    ]
    return [r for r in records if r["entries"]]


def _record_from_reigns(
    df: pd.DataFrame,
    *,
    key: str,
    label: str,
    kind: str,
    unit: str,
    sort_column: str,
    value_column: str,
    ascending: bool = False,
) -> dict:
    working = df.dropna(subset=[sort_column]).copy()
    working = working.sort_values(sort_column, ascending=ascending)
    entries = []
    for rank, row in enumerate(working.head(TOP_N_PER_RECORD).to_dict(orient="records"), start=1):
        entries.append(
            {
                "rank": rank,
                "champion": row["champion"],
                "fighter_url": _nullable_string(row.get("fighter_url")),
                "division": row["division"],
                "value": int(row[value_column]),
                "detail": f"{row['event']} ({row.get('date_won')})" if row.get("event") else None,
            }
        )
    return {"key": key, "label": label, "kind": kind, "unit": unit, "entries": entries}


def _record_by_champion(
    df: pd.DataFrame,
    *,
    key: str,
    label: str,
    kind: str,
    unit: str,
    agg_column: str | None,
    agg: str,
) -> dict:
    rows = []
    for champion, group in df.groupby("champion"):
        fighter_url = next((u for u in group["fighter_url"] if isinstance(u, str) and u), None)
        divisions = sorted(group["division"].unique().tolist())
        if agg == "sum":
            value = int(group[agg_column].sum())
        elif agg == "count":
            value = int(len(group))
        elif agg == "count_stripped":
            value = int((group["end_reason"] == "stripped").sum())
        elif agg == "count_lost":
            value = int(group["end_reason"].isin(["stripped", "vacated", "lost_title_fight"]).sum())
        else:
            raise ValueError(f"Unknown aggregation: {agg}")
        if value > 0:
            rows.append({"champion": champion, "fighter_url": fighter_url, "divisions": divisions, "value": value})

    rows.sort(key=lambda r: -r["value"])
    entries = []
    for rank, row in enumerate(rows[:TOP_N_PER_RECORD], start=1):
        entries.append(
            {
                "rank": rank,
                "champion": row["champion"],
                "fighter_url": row["fighter_url"],
                "division": ", ".join(row["divisions"]) if len(row["divisions"]) > 1 else row["divisions"][0],
                "value": row["value"],
                "detail": None,
            }
        )
    return {"key": key, "label": label, "kind": kind, "unit": unit, "entries": entries}


def _multi_division_record(df: pd.DataFrame) -> dict:
    rows = []
    for champion, group in df.groupby("champion"):
        divisions = sorted(group["division"].unique().tolist())
        if len(divisions) < 2:
            continue
        fighter_url = next((u for u in group["fighter_url"] if isinstance(u, str) and u), None)
        rows.append({"champion": champion, "fighter_url": fighter_url, "divisions": divisions})

    rows.sort(key=lambda r: -len(r["divisions"]))
    entries = []
    for rank, row in enumerate(rows[:TOP_N_PER_RECORD], start=1):
        entries.append(
            {
                "rank": rank,
                "champion": row["champion"],
                "fighter_url": row["fighter_url"],
                "division": ", ".join(row["divisions"]),
                "value": len(row["divisions"]),
                "detail": None,
            }
        )
    return {
        "key": "multi_division_champions",
        "label": "Multi-division champions",
        "kind": "positive",
        "unit": "divisions",
        "entries": entries,
    }


def _nullable_string(value) -> str | None:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    text = str(value).strip()
    return text or None


def _nullable_int(value) -> int | None:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    return int(value)
