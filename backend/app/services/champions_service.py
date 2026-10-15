from __future__ import annotations

import re
import unicodedata
from datetime import date

import pandas as pd

from src.ufc_predictor.config import RAW_DATA_DIR

TITLE_REIGNS_SOURCE_PATH = RAW_DATA_DIR / "title_reigns.csv"
FIGHTS_SOURCE_PATH = RAW_DATA_DIR / "fights.csv"

TOP_N_GREATEST_CHAMPIONS = 15
TOP_N_PER_RECORD = 10


def _source_signature() -> tuple:
    return tuple(
        path.stat().st_mtime_ns if path.exists() else None for path in (TITLE_REIGNS_SOURCE_PATH, FIGHTS_SOURCE_PATH)
    )


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
    for reign in current_champions:
        reign["last_fight"] = _last_fight(reign["champion"])

    greatest_champions = _build_greatest_champions(df)
    records = _build_records(df, _load_fights_df())

    return {
        "current_champions": current_champions,
        "greatest_champions": greatest_champions,
        "records": records,
    }


def _last_fight(name: str) -> dict | None:
    """The champion's most recent UFC fight, for the champions page."""
    from .fight_history_service import get_fights_for_fighter

    fights = get_fights_for_fighter(name)
    if not fights:
        return None
    latest = fights[0]
    return {
        "event": latest["event_name"],
        **{key: latest[key] for key in ("date", "opponent", "result", "method", "round", "time")},
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


def _build_records(df: pd.DataFrame, fights: pd.DataFrame | None = None) -> list[dict]:
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
        _multi_division_record(df, fights),
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


def _multi_division_record(df: pd.DataFrame, fights: pd.DataFrame | None = None) -> dict:
    rows = []
    for champion, group in df.groupby("champion"):
        divisions = sorted(group["division"].unique().tolist())
        if len(divisions) < 2:
            continue
        fighter_url = next((u for u in group["fighter_url"] if isinstance(u, str) and u), None)
        rows.append({"champion": champion, "fighter_url": fighter_url, "divisions": divisions, "group": group})

    rows.sort(key=lambda r: -len(r["divisions"]))
    entries = []
    # Every multi-division champion is listed: the card shows each one's whole title history.
    for rank, row in enumerate(rows, start=1):
        entries.append(
            {
                "rank": rank,
                "champion": row["champion"],
                "fighter_url": row["fighter_url"],
                "division": ", ".join(row["divisions"]),
                "value": len(row["divisions"]),
                "detail": None,
                "title_wins": _title_wins(row["group"], fights),
                "title_fights": _title_fight_timeline(row["champion"], row["group"]),
            }
        )
    return {
        "key": "multi_division_champions",
        "label": "Multi-division champions",
        "kind": "positive",
        "unit": "divisions",
        "entries": entries,
    }


def _load_fights_df() -> pd.DataFrame:
    if not FIGHTS_SOURCE_PATH.exists():
        return pd.DataFrame()
    return pd.read_csv(FIGHTS_SOURCE_PATH, keep_default_na=False, na_values=[""])


def _name_key(value) -> str:
    text = unicodedata.normalize("NFKD", str(value)).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def _title_wins(group: pd.DataFrame, fights: pd.DataFrame | None) -> list[dict]:
    """One entry per division: the fight that first won the belt there (undisputed preferred over interim),
    plus every successful defense made in that division. Opponent/method/round come from fights.csv
    (matched by event + winner) because title_reigns.csv only records them for some reigns."""
    wins = []
    for division, reigns in group.groupby("division"):
        reigns = reigns.sort_values("date_won")
        undisputed = reigns[reigns["title_type"] == "undisputed"]
        first = (undisputed if len(undisputed) else reigns).iloc[0]
        champion = first["champion"]

        opponent = _nullable_string(first.get("opponent_beaten")) or _opponent_from_won_how(first.get("won_how"))
        method = round_number = None
        fight = _find_title_fight(fights, first.get("event"), champion)
        if fight is not None:
            opponent = opponent or str(fight["fighter_2"])
            method = _format_method(fight.get("method"))
            round_number = _nullable_int(fight.get("round"))

        wins.append(
            {
                "division": division,
                "title_type": first["title_type"],
                "opponent": opponent,
                "event": _nullable_string(first.get("event")),
                "date": _nullable_string(first.get("date_won")),
                "method": method,
                "round": round_number,
                "won_how": _nullable_string(first.get("won_how")),
                "defenses": int(reigns["defenses_count"].sum()),
                "reigns_in_division": int(len(reigns)),
            }
        )
    wins.sort(key=lambda w: w["date"] or "")
    return wins


def _title_fight_timeline(champion: str, reigns: pd.DataFrame) -> list[dict]:
    """Every championship bout of a fighter, oldest first: title shots, belt wins, defenses and lost belts.

    Bouts come from the fight history (title_fight flag; BMF bouts are not divisional titles). Each one is
    labelled against the fighter's own reigns: a win on the day a reign began is a belt win, a win inside a
    reign is a defense, a loss inside a reign is a lost belt, and anything else is a challenge."""
    from .fight_history_service import get_fights_for_fighter

    # Reign tables spell some names with dots ("B.J. Penn") that the fight history drops ("BJ Penn").
    history = get_fights_for_fighter(champion) or get_fights_for_fighter(champion.replace(".", ""))
    title_bouts = sorted((f for f in history if f["title_fight"] and f["date"]), key=lambda f: f["date"])

    belts = []
    for reign in reigns.sort_values("date_won").to_dict(orient="records"):
        start = pd.to_datetime(reign["date_won"], errors="coerce")
        if pd.isna(start):
            continue
        days = reign.get("days_held_effective", reign.get("days_held"))
        end = start + pd.Timedelta(days=int(days)) if pd.notna(days) else start
        belts.append({**reign, "start": start.date().isoformat(), "end": end.date().isoformat()})

    defenses_in_reign: dict[int, int] = {}
    timeline = []
    for bout in title_bouts:
        result = bout["result"]
        if result is None:
            result = "no_contest" if str(bout.get("outcome") or "").lower().startswith("no") or bout.get("method") == "Overturned" else "draw"
        # Belts held at the same time in two divisions (e.g. Nunes) must not be mixed up.
        reign = next(
            (
                b
                for b in belts
                if b["start"] <= bout["date"] <= b["end"] and _name_key(b["division"]) == _name_key(bout["weight_class"])
            ),
            None,
        )

        title_type = None
        if result == "win" and reign is not None and bout["date"] == reign["start"]:
            role, title_type = "won_title", reign["title_type"]
            label = "Won interim title" if title_type == "interim" else "Won title"
        elif result == "win" and reign is not None and reign["title_type"] == "undisputed":
            role, title_type = "defense", reign["title_type"]
            defenses_in_reign[id(reign)] = defenses_in_reign.get(id(reign), 0) + 1
            label = f"Title defense #{defenses_in_reign[id(reign)]}"
        elif result == "loss" and reign is not None and reign["start"] < bout["date"]:
            role, title_type = "lost_title", reign["title_type"]
            label = "Lost title"
        elif result == "win":
            role, label = "other", "Title fight win"
        elif result == "loss":
            role, label = "challenge", "Title shot, lost"
        else:
            role, label = "other", "Title fight, draw" if result == "draw" else "Title fight, no contest"

        timeline.append(
            {
                "date": bout["date"],
                "event": bout["event_name"],
                "division": bout["weight_class"],
                "opponent": bout["opponent"],
                "result": result,
                "role": role,
                "label": label,
                "title_type": title_type,
                "method": _format_method(bout.get("method")),
                "round": bout.get("round"),
            }
        )
    return timeline


def _opponent_from_won_how(value) -> str | None:
    match = re.match(r"def\.\s+(?:interim champion\s+)?(.+?)(?:\s+for interim title)?$", _nullable_string(value) or "")
    return match.group(1) if match else None


def _find_title_fight(fights: pd.DataFrame | None, event, champion) -> dict | None:
    """The bout at `event` (e.g. "UFC 281") won by `champion`; fights.csv lists the winner as fighter_1."""
    if fights is None or fights.empty or not isinstance(event, str) or not event.strip():
        return None
    prefix = event.strip()
    names = fights["event_name"].astype(str)
    in_event = fights[(names == prefix) | names.str.startswith(prefix + ":")]
    key = _name_key(champion)
    won = in_event[in_event["fighter_1"].map(_name_key) == key]
    return won.iloc[0].to_dict() if len(won) else None


_DECISIONS = {"U-DEC": "Unanimous Decision", "S-DEC": "Split Decision", "M-DEC": "Majority Decision"}


def _format_method(raw) -> str | None:
    text = _nullable_string(raw)
    if not text:
        return None
    if text in _DECISIONS:
        return _DECISIONS[text]
    if text.startswith("KO/TKO"):
        return "KO/TKO"
    if text.startswith("SUB"):
        detail = text[3:].strip()
        return f"Submission ({detail})" if detail else "Submission"
    if text.startswith("DQ"):
        return "Disqualification"
    return text


def _nullable_string(value) -> str | None:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    text = str(value).strip()
    return text or None


def _nullable_int(value) -> int | None:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    return int(value)
