from __future__ import annotations

import pandas as pd
from sklearn.neighbors import NearestNeighbors
from sklearn.preprocessing import StandardScaler

from backend.app.services.catalog_service import _normalize_name, get_fighter_catalog

# Physical + performance attributes available for (almost) every fighter in the catalog.
# Missing values are mean-imputed before scaling, a standard practice for distance-based
# similarity — it never overrides what a fighter's own profile actually displays.
SIMILARITY_FEATURES = ["age", "height_cm", "weight_lbs", "reach_cm", "win_rate", "sig_str_acc", "takedown_acc"]


def get_similar_fighters(name: str, limit: int = 5) -> list[dict]:
    catalog = get_fighter_catalog()
    key = _normalize_name(name)
    matches = catalog.index[catalog["profile_key"] == key]
    if matches.empty:
        raise KeyError(f"Fighter '{name}' was not found in the catalog.")

    features = catalog[SIMILARITY_FEATURES].copy()
    features = features.fillna(features.mean(numeric_only=True))
    scaled = StandardScaler().fit_transform(features.to_numpy())

    target_position = catalog.index.get_loc(matches[0])
    neighbor_count = min(limit + 1, len(scaled))  # +1 because the fighter itself is always closest
    model = NearestNeighbors(n_neighbors=neighbor_count, metric="euclidean").fit(scaled)
    distances, positions = model.kneighbors(scaled[[target_position]])

    results: list[dict] = []
    for distance, position in zip(distances[0], positions[0]):
        if position == target_position:
            continue
        row = catalog.iloc[position]
        results.append(
            {
                "name": row["name"],
                "similarity": round(1 / (1 + float(distance)), 4),
                "division": row["division"] if pd.notna(row["division"]) else None,
                "wins": int(row["wins"]),
                "losses": int(row["losses"]),
                "draws": int(row["draws"]),
                "image_url": row["image_url"] if pd.notna(row["image_url"]) else None,
            }
        )

    return results[:limit]
