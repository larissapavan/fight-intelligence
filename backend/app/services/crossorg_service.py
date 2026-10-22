"""Fighters who have fought in the UFC and in another organization, so their history can be read in one place.

The UFC pipeline and the other organizations' files never share an id, so the link is the name (accents, case and
punctuation ignored, and the UFC's own spelling aliases applied). A wrong link would put someone else's fights on a
profile, so a name is linked only when it passes every guard below:

    - the name is unique on both sides;
    - the UFC profile has at least one UFC fight (the catalog also holds people who never fought there);
    - not across men's and women's divisions;
    - the two weight classes are at most MAX_DIVISION_GAP apart (two different men called David Martinez, a bantamweight
      and a welterweight, are not one fighter).

This module only reads: it adds a second list of fights to a profile. Nothing here writes to the UFC files, and the
prediction model never reads it. The model's inputs (the record, the striking and takedown numbers, the pre-fight history)
come from the UFC catalog and event_cards.csv, which are untouched.
"""

from __future__ import annotations

from backend.app.services.catalog_service import canonical_name, get_fighter_catalog
from backend.app.services.org_service import ORGS, _name_key, get_org_fighter_fights, get_org_fighters

MAX_DIVISION_GAP = 2
MEN_ORDER = ["strawweight", "flyweight", "bantamweight", "featherweight", "lightweight", "welterweight", "middleweight", "light heavyweight", "heavyweight"]

_cache: dict = {"catalog": None, "ufc": {}}


def _womens(division: str | None) -> bool | None:
    return None if not division else division.lower().startswith("women")


def _division_rank(division: str | None) -> int | None:
    if not division:
        return None
    name = division.lower().replace("women's ", "")
    return MEN_ORDER.index(name) if name in MEN_ORDER else None


def _ufc_index() -> dict[str, tuple[str, str | None]]:
    """name key -> (UFC name, division) for every UFC fighter whose key is unique and who has fought in the UFC."""
    catalog = get_fighter_catalog()
    if _cache["catalog"] is not catalog:
        seen: dict[str, list[tuple[str, str | None]]] = {}
        for record in catalog.to_dict(orient="records"):
            division = record.get("division")
            if record.get("ufc_status") == "never":
                continue
            seen.setdefault(_name_key(record["name"]), []).append((record["name"], division if isinstance(division, str) else None))
        _cache.update(catalog=catalog, ufc={key: rows[0] for key, rows in seen.items() if len(rows) == 1})
    return _cache["ufc"]


def _linked(ufc: tuple[str, str | None], org_division: str | None) -> bool:
    ufc_womens, org_womens = _womens(ufc[1]), _womens(org_division)
    if ufc_womens is not None and org_womens is not None and ufc_womens != org_womens:
        return False
    ufc_rank, org_rank = _division_rank(ufc[1]), _division_rank(org_division)
    return ufc_rank is None or org_rank is None or abs(ufc_rank - org_rank) <= MAX_DIVISION_GAP


def ufc_names_for_org(org_id: str) -> dict[str, str]:
    """Org fighter name key -> the UFC name of the same person, for the fighters of that organization who fought in the UFC."""
    index = _ufc_index()
    links: dict[str, str] = {}
    for fighter in get_org_fighters(org_id):
        key = _name_key(fighter["name"])
        match = index.get(key) or index.get(_name_key(canonical_name(fighter["name"]) or ""))
        if match and _linked(match, fighter["division"]):
            links[key] = match[0]
    return links


def ufc_name_of(org_id: str, org_name: str) -> str | None:
    return ufc_names_for_org(org_id).get(_name_key(org_name))


def other_organizations(ufc_name: str) -> list[dict]:
    """The fights this UFC fighter had in every other organization: [{org_id, short_name, name, fighter_name, org_record, fights}]."""
    index = _ufc_index()
    profile = index.get(_name_key(ufc_name))
    if profile is None:
        return []
    found = []
    for org in ORGS.values():
        for fighter in get_org_fighters(org.id):
            if _name_key(fighter["name"]) != _name_key(profile[0]) and _name_key(canonical_name(fighter["name"]) or "") != _name_key(profile[0]):
                continue
            if not _linked(profile, fighter["division"]):
                continue
            fights = get_org_fighter_fights(org.id, fighter["name"])
            if fights:
                found.append(
                    {
                        "org_id": org.id,
                        "short_name": org.short_name,
                        "name": org.name,
                        "fighter_name": fighter["name"],
                        "org_record": fighter["org_record"],
                        "fights": fights,
                    }
                )
            break
    return found
