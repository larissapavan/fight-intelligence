"""Download fighter photos into frontend/public/fighter-photos and register them in data/raw/fighter_photos.csv.

Two sources, both public:
- Champions: the divisional champion cards on https://www.ufc.com/rankings (always the current belt photo, so a
  title change is picked up on the next run; photos of fighters who lost the belt are removed).
- Everyone else: ESPN headshots (https://a.espncdn.com/i/headshots/mma/players/full/<id>.png). They have the same
  head-and-shoulders framing as the champion photos, so the app looks consistent; the live Octagon API
  (full-body photos, often outdated belt shots) is only the fallback for fighters ESPN has no headshot for.
  Fighters already covered by lutadores_historicos.csv are skipped.

Images are re-encoded to small WebP files (the originals are 300 KB+ PNGs) to keep the Vercel deploy light.
The backend (catalog_service) reads fighter_photos.csv and exposes the photo as the fighter's image_url, which the
frontend prefers over the Octagon API image.

Usage (from the repo root):
    python -m scripts.download_fighter_photos                 # champions + missing
    python -m scripts.download_fighter_photos --champions
    python -m scripts.download_fighter_photos --missing --limit 200
    python -m scripts.download_fighter_photos --optimize-existing   # shrink the historical photos in place
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import re
import sys
import time
from datetime import date
from pathlib import Path

import requests
from bs4 import BeautifulSoup
from PIL import Image

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from scripts.scrape_espn import (
    SCOREBOARD_URL,
    Catalog,
    EspnClient,
    EspnFighter,
    ascii_name,
    espn_id_from_url,
    load_csv,
    name_key,
    parse_scoreboard,
)
from scripts.scrape_rankings import HEADERS as UFC_HEADERS
from scripts.scrape_rankings import RANKINGS_URL
from src.ufc_predictor.config import BASE_DIR, RAW_DATA_DIR

PHOTOS_DIR = BASE_DIR / "frontend" / "public" / "fighter-photos"
WEB_PREFIX = "/fighter-photos/"
MANIFEST_PATH = RAW_DATA_DIR / "fighter_photos.csv"
HISTORICAL_MANIFEST_PATH = BASE_DIR / "lutadores_historicos.csv"
FIGHTERS_PATH = RAW_DATA_DIR / "fighters.csv"
CAREER_STATS_PATH = RAW_DATA_DIR / "fighter_career_stats.csv"
ESPN_HEADSHOT_URL = "https://a.espncdn.com/i/headshots/mma/players/full/{athlete_id}.png"

MANIFEST_FIELDS = ["name", "kind", "source", "source_url", "image_url", "local_path", "checked"]
ESPN_MAX_WIDTH = 300
CHAMPION_MAX_SIDE = 420
WEBP_QUALITY = 80
REQUEST_DELAY_SECONDS = 0.25
TIMEOUT_SECONDS = 30
CHAMPION_HEADER_LABELS = {  # ufc.com (pt-BR) division header -> title_reigns.csv division
    "Peso-mosca": "Flyweight", "Peso-galo": "Bantamweight", "Peso-pena": "Featherweight",
    "Peso-leve": "Lightweight", "Peso Meio-Médio": "Welterweight", "Peso-médio": "Middleweight",
    "Peso meio-pesado": "Light Heavyweight", "Peso-pesado": "Heavyweight",
    "Peso-palha feminino": "Women's Strawweight", "Peso-mosca feminino": "Women's Flyweight",
    "Peso-galo feminino": "Women's Bantamweight", "Peso-pena feminino": "Women's Featherweight",
}


# --------------------------------------------------------------------------- images


def to_webp(data: bytes, *, max_width: int | None = None, max_side: int | None = None) -> bytes:
    image = Image.open(io.BytesIO(data)).convert("RGBA")
    if max_width and image.width > max_width:
        image = image.resize((max_width, round(image.height * max_width / image.width)), Image.LANCZOS)
    if max_side and max(image.size) > max_side:
        image.thumbnail((max_side, max_side), Image.LANCZOS)
    out = io.BytesIO()
    image.save(out, format="WEBP", quality=WEBP_QUALITY, method=6)
    return out.getvalue()


def slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", ascii_name(name).lower()).strip("-")


def version_tag(data: bytes) -> str:
    return hashlib.sha1(data).hexdigest()[:8]


# --------------------------------------------------------------------------- manifest


def load_manifest() -> list[dict]:
    if not MANIFEST_PATH.exists():
        return []
    return load_csv(MANIFEST_PATH)[1]


def save_manifest(rows: list[dict]) -> None:
    with MANIFEST_PATH.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=MANIFEST_FIELDS, lineterminator="\r\n", extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def covered_keys(rows: list[dict]) -> set[str]:
    """Names that already have a local photo (historical set + this manifest)."""
    keys = {name_key(r["name"]) for r in rows if r.get("local_path")}
    if HISTORICAL_MANIFEST_PATH.exists():
        keys |= {name_key(r["name"]) for r in load_csv(HISTORICAL_MANIFEST_PATH)[1] if r.get("local_path")}
    return keys


def checked_keys(rows: list[dict]) -> set[str]:
    return {name_key(r["name"]) for r in rows if r["kind"] == "espn"}


def photo_skip_keys(rows: list[dict], retry_missing: bool, recheck: set[str]) -> set[str]:
    """Fighters the ESPN step leaves alone: the ones with a photo, the champions, and (unless retrying) the ones ESPN
    had no photo for. `recheck` are active fighters the site still shows without a photo: ESPN often publishes a
    debutant's headshot a few days after the profile exists, so those are asked again on every run."""
    champions = {name_key(r["name"]) for r in rows if r["kind"] == "champion"}
    skip = covered_keys(rows) | champions
    if not retry_missing:
        skip |= checked_keys(rows) - (recheck - covered_keys(rows) - champions)
    return skip


# --------------------------------------------------------------------------- ufc.com athlete pages

UFC_ATHLETE_URL = "https://www.ufc.com/athlete/{slug}"
UFC_DELAY_SECONDS = 1.0


def parse_athlete_photo(html: str) -> str | None:
    """The headshot on a ufc.com athlete page, or None for the generic silhouette ufc.com shows when it has no photo."""
    tag = BeautifulSoup(html, "html.parser").find("meta", property="og:image")
    url = (tag.get("content") or "").strip() if tag else ""
    return None if not url or "silhouette" in url.lower() else url


def sync_ufc_page_photos(session: requests.Session, rows: list[dict], names: list[str]) -> int:
    """Photos from the ufc.com athlete page for fighters ESPN has none for (typically new debutants)."""
    added = 0
    covered = covered_keys(rows)
    for name in names:
        if name_key(name) in covered:
            continue
        try:
            page = session.get(UFC_ATHLETE_URL.format(slug=slugify(name)), timeout=TIMEOUT_SECONDS)
            url = parse_athlete_photo(page.text) if page.status_code == 200 else None
            image = session.get(url, timeout=TIMEOUT_SECONDS) if url else None
        except requests.RequestException:
            continue
        finally:
            time.sleep(UFC_DELAY_SECONDS)
        if image is None or image.status_code != 200:
            continue
        encoded = to_webp(image.content, max_width=ESPN_MAX_WIDTH)
        filename = f"{slugify(name)}.webp"
        (PHOTOS_DIR / filename).write_bytes(encoded)
        rows.append(
            {
                "name": name,
                "kind": "ufc",
                "source": "ufc.com athlete page",
                "source_url": url,
                "image_url": f"/fighter-photos/{filename}?v={version_tag(encoded)}",
                "local_path": f"frontend/public/fighter-photos/{filename}",
                "checked": date.today().isoformat(),
            }
        )
        added += 1
    return added


def active_without_photo() -> list[str]:
    """Active fighters the site shows without a photo."""
    from backend.app.services.catalog_service import list_fighters

    return [fighter["name"] for fighter in list_fighters(ufc_only=True) if fighter.get("is_active") and not fighter.get("image_url")]


# --------------------------------------------------------------------------- champions


def parse_champions(html: str) -> list[tuple[str, str, str]]:
    """[(division, name, image_url)] from the divisional champion cards on ufc.com/rankings."""
    soup = BeautifulSoup(html, "html.parser")
    champions = []
    for group in soup.select(".view-grouping")[:13]:
        header = group.select_one(".view-grouping-header")
        division = CHAMPION_HEADER_LABELS.get(header.get_text(strip=True)) if header else None
        card = group.select_one(".rankings--athlete--champion")
        if division is None or card is None:
            continue
        link, image = card.select_one("h5 a"), card.select_one("img")
        source = (image.get("src") or image.get("data-src") or "") if image else ""
        if link is not None and source:
            champions.append((division, link.get_text(strip=True), source))
    return champions


def sync_champions(session: requests.Session, rows: list[dict], catalog: Catalog) -> list[dict]:
    response = session.get(RANKINGS_URL, headers=UFC_HEADERS, timeout=TIMEOUT_SECONDS)
    response.raise_for_status()
    response.encoding = "utf-8"
    champions = parse_champions(response.text)
    if not champions:
        raise RuntimeError("No champions found on ufc.com/rankings - page structure may have changed.")

    wanted = set()
    for division, name, source in champions:
        row, status = catalog.find(EspnFighter("", name, None))
        catalog_name = catalog.name_of(row) if row is not None and status in {"exact", "fuzzy"} else ascii_name(name)
        filename = f"{slugify(catalog_name)}-champion.webp"
        data = session.get(source, headers=UFC_HEADERS, timeout=TIMEOUT_SECONDS)
        data.raise_for_status()
        encoded = to_webp(data.content, max_side=CHAMPION_MAX_SIDE)
        (PHOTOS_DIR / filename).write_bytes(encoded)
        wanted.add(filename)
        rows[:] = [r for r in rows if not (r["kind"] == "champion" and r["name"] == catalog_name)]
        rows.append(
            {
                "name": catalog_name, "kind": "champion", "source": f"ufc.com ({division})", "source_url": source.split("?")[0],
                "image_url": f"{WEB_PREFIX}{filename}?v={version_tag(encoded)}",
                "local_path": f"frontend/public/fighter-photos/{filename}", "checked": date.today().isoformat(),
            }
        )
        print(f"  champion: {division}: {catalog_name} ({len(encoded) // 1024} KB)")
        time.sleep(REQUEST_DELAY_SECONDS)

    # Former champions fall back to the other photo sources.
    for row in [r for r in rows if r["kind"] == "champion" and Path(r["local_path"]).name not in wanted]:
        (BASE_DIR / row["local_path"]).unlink(missing_ok=True)
        rows.remove(row)
        print(f"  champion photo removed (no longer champion): {row['name']}")
    return rows


# --------------------------------------------------------------------------- ESPN headshots


def espn_athletes(client: EspnClient, since_year: int = 1993) -> dict[str, EspnFighter]:
    """Every ESPN athlete in the UFC history, with the latest record seen."""
    athletes: dict[str, EspnFighter] = {}
    for year in range(since_year, date.today().year + 1):
        payload = client.get_json(SCOREBOARD_URL, {"dates": f"{year}0101-{year}1231", "limit": 500})
        for event in sorted(parse_scoreboard(payload), key=lambda e: e.day):
            for bout in event.bouts:
                for fighter in bout.fighters:
                    athletes[fighter.espn_id] = fighter
        time.sleep(REQUEST_DELAY_SECONDS)
    return athletes


def sync_espn_photos(
    session: requests.Session, rows: list[dict], catalog: Catalog, limit: int | None, retry_missing: bool
) -> None:
    client = EspnClient()
    print("[info] Reading ESPN athlete ids from the UFC history ...")
    athletes = espn_athletes(client)
    id_by_row: dict[int, list[str]] = {}
    for athlete in athletes.values():
        row, status = catalog.find(athlete)
        if row is not None and status in {"exact", "fuzzy"}:
            id_by_row.setdefault(id(row), []).append(athlete.espn_id)
    for row in catalog.rows:  # fighters created from ESPN carry the id in their profile link
        athlete_id = espn_id_from_url(row.get("fighter_url", ""))
        if athlete_id:
            id_by_row[id(row)] = [athlete_id]

    skip = photo_skip_keys(rows, retry_missing, {name_key(name) for name in active_without_photo()})
    todo = []
    for row in catalog.rows:
        ids = id_by_row.get(id(row), [])
        if len(ids) == 1 and name_key(catalog.name_of(row)) not in skip:
            todo.append((catalog.name_of(row), ids[0]))
    if limit:
        todo = todo[:limit]
    print(f"[info] {len(todo)} fighters to check on ESPN")

    saved = missing = errors = 0
    existing_files = {Path(r["local_path"]).name: r["name"] for r in rows if r.get("local_path")}

    def record(entry: dict) -> None:
        """Replace an earlier "no photo" row for the same fighter instead of stacking a duplicate on every retry."""
        rows[:] = [r for r in rows if not (r["kind"] == "espn" and not r.get("local_path") and name_key(r["name"]) == name_key(entry["name"]))]
        rows.append(entry)

    for index, (name, athlete_id) in enumerate(todo, 1):
        url = ESPN_HEADSHOT_URL.format(athlete_id=athlete_id)
        entry = {"name": name, "kind": "espn", "source": "ESPN", "source_url": url, "image_url": "", "local_path": "", "checked": date.today().isoformat()}
        try:
            response = session.get(url, timeout=TIMEOUT_SECONDS)
        except requests.RequestException as exc:
            errors += 1
            print(f"  [error] {name}: {exc.__class__.__name__}")
            continue
        if response.status_code == 404:
            missing += 1
            record(entry)
        elif response.status_code == 200:
            try:
                encoded = to_webp(response.content, max_width=ESPN_MAX_WIDTH)
            except OSError:
                # A 200 that is not an image (a placeholder): same as no photo, so it is not asked again every run.
                missing += 1
                print(f"  [info] {name}: ESPN's file is not a usable image, treated as no photo")
                record(entry)
                continue
            filename = f"{slugify(name)}.webp"
            if existing_files.get(filename, name) != name:
                filename = f"{slugify(name)}-{athlete_id}.webp"
            (PHOTOS_DIR / filename).write_bytes(encoded)
            existing_files[filename] = name
            entry.update({"image_url": f"{WEB_PREFIX}{filename}", "local_path": f"frontend/public/fighter-photos/{filename}"})
            record(entry)
            saved += 1
        else:
            errors += 1  # 429/5xx: not recorded, retried on the next run
            print(f"  [error] {name}: HTTP {response.status_code}")
            time.sleep(2)
        if index % 100 == 0:
            save_manifest(rows)
            print(f"  [{index}/{len(todo)}] saved={saved} no-photo={missing} errors={errors}")
        time.sleep(REQUEST_DELAY_SECONDS)
    save_manifest(rows)
    print(f"[info] ESPN photos saved: {saved} | no photo on ESPN: {missing} | errors (retry later): {errors}")


# --------------------------------------------------------------------------- optimize existing


def optimize_existing(max_side: int = 400, quality: int = 82) -> None:
    """Re-encode the historical photos (often several MB) as small JPEGs, in place."""
    if not HISTORICAL_MANIFEST_PATH.exists():
        return
    before = after = 0
    for row in load_csv(HISTORICAL_MANIFEST_PATH)[1]:
        path = PHOTOS_DIR / Path(row["local_path"]).name
        if not row.get("local_path") or not path.exists():
            continue
        raw = path.read_bytes()
        before += len(raw)
        image = Image.open(io.BytesIO(raw)).convert("RGB")
        image.thumbnail((max_side, max_side), Image.LANCZOS)
        out = io.BytesIO()
        image.save(out, format="JPEG", quality=quality, optimize=True)
        if len(out.getvalue()) < len(raw):
            path.write_bytes(out.getvalue())
        after += min(len(raw), len(out.getvalue()))
    print(f"[info] historical photos: {before / 1e6:.1f} MB -> {after / 1e6:.1f} MB")


# --------------------------------------------------------------------------- main


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--champions", action="store_true", help="refresh champion belt photos from ufc.com")
    parser.add_argument("--missing", action="store_true", help="download ESPN headshots for fighters without a photo")
    parser.add_argument("--ufc-pages", action="store_true", help="photos from ufc.com athlete pages for active fighters still without one")
    parser.add_argument("--optimize-existing", action="store_true", help="shrink the historical photos in place")
    parser.add_argument("--limit", type=int, help="max fighters to check on ESPN in this run")
    parser.add_argument("--retry-missing", action="store_true", help="re-check fighters ESPN had no photo for")
    args = parser.parse_args(argv)
    run_all = not (args.champions or args.missing or args.optimize_existing or args.ufc_pages)

    PHOTOS_DIR.mkdir(parents=True, exist_ok=True)
    session = requests.Session()
    session.headers.update({"User-Agent": "ufcpredictor/1.0 (personal project)"})

    if args.optimize_existing:
        optimize_existing()
    if args.champions or args.missing or args.ufc_pages or run_all:
        rows = load_manifest()
        fighters = load_csv(FIGHTERS_PATH)[1]
        career = load_csv(CAREER_STATS_PATH)[1] if CAREER_STATS_PATH.exists() else []
        catalog = Catalog(fighters, career)
        if args.champions or run_all:
            print("[info] Champion photos (ufc.com/rankings) ...")
            sync_champions(session, rows, catalog)
            save_manifest(rows)
        if args.missing or run_all:
            sync_espn_photos(session, rows, catalog, args.limit, args.retry_missing)
        if args.ufc_pages or run_all:
            print("[info] Active fighters without a photo (ufc.com athlete pages) ...")
            rows = load_manifest()
            added = sync_ufc_page_photos(session, rows, active_without_photo())
            save_manifest(rows)
            print(f"[info] ufc.com photos added: {added}")


if __name__ == "__main__":
    main()
