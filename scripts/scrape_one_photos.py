"""Download official ONE Championship fighter photos from onefc.com and register them in data/raw/one/fighters.csv.

Images are saved as optimized WebP files in frontend/public/fighter-photos/one/
and exposed in data/raw/one/fighters.csv under image_url (/fighter-photos/one/<slug>.webp)
and headshot_url (the official cdn.onefc.com image URL).

Usage (from the repo root):
    python -m scripts.scrape_one_photos --limit 150
    python -m scripts.scrape_one_photos --all
"""

from __future__ import annotations

import argparse
import csv
import io
import re
import sys
import time
import unicodedata
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import requests
from bs4 import BeautifulSoup
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / "data" / "raw" / "one"
FIGHTERS_PATH = RAW_DIR / "fighters.csv"
RANKINGS_PATH = RAW_DIR / "rankings.csv"
PHOTOS_DIR = ROOT / "frontend" / "public" / "fighter-photos" / "one"
PHOTOS_WEB_PREFIX = "/fighter-photos/one/"

SITEMAP_URL = "https://www.onefc.com/sitemap_index.xml"
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
MAX_WIDTH = 300
WEBP_QUALITY = 80
TIMEOUT = 15

KNOWN_ALIASES = {
    "Marcus Buchecha": "https://www.onefc.com/athletes/marcus-almeida/",
    "Superbon Singha Mawynn": "https://www.onefc.com/athletes/superbon/",
    "Prajanchai PK Saenchai": "https://www.onefc.com/athletes/prajanchai/",
    "Tawanchai PK Saenchai": "https://www.onefc.com/athletes/tawanchai/",
    "Ham Seo Hee": "https://www.onefc.com/athletes/seo-hee-ham/",
    "Aung La N Sang": "https://www.onefc.com/athletes/aung-la-n-sang/",
    "Nong-O Gaiyanghadao": "https://www.onefc.com/athletes/nong-o-gaiyanghadao/",
    "Rodtang Jitmuangnon": "https://www.onefc.com/athletes/rodtang-jitmuangnon/",
    "Superlek Kiatmoo9": "https://www.onefc.com/athletes/superlek-kiatmoo9/",
    "Stamp Fairtex": "https://www.onefc.com/athletes/stamp-fairtex/",
    "Christian Lee": "https://www.onefc.com/athletes/christian-lee/",
    "Angela Lee": "https://www.onefc.com/athletes/angela-lee/",
    "Tang Kai": "https://www.onefc.com/athletes/tang-kai/",
    "Demetrious Johnson": "https://www.onefc.com/athletes/demetrious-johnson/",
    "Anatoly Malykhin": "https://www.onefc.com/athletes/anatoly-malykhin/",
    "Oumar Kane": "https://www.onefc.com/athletes/oumar-kane/",
    "Jonathan Haggerty": "https://www.onefc.com/athletes/jonathan-haggerty/",
    "John Lineker": "https://www.onefc.com/athletes/john-lineker/",
    "Adriano Moraes": "https://www.onefc.com/athletes/adriano-moraes/",
    "Joshua Pacio": "https://www.onefc.com/athletes/joshua-pacio/",
    "Jarred Brooks": "https://www.onefc.com/athletes/jarred-brooks/",
    "Yuya Wakamatsu": "https://www.onefc.com/athletes/yuya-wakamatsu/",
    "Danny Kingad": "https://www.onefc.com/athletes/danny-kingad/",
    "Shinya Aoki": "https://www.onefc.com/athletes/shinya-aoki/",
    "Eduard Folayang": "https://www.onefc.com/athletes/eduard-folayang/",
    "Kevin Belingon": "https://www.onefc.com/athletes/kevin-belingon/",
    "Bibiano Fernandes": "https://www.onefc.com/athletes/bibiano-fernandes/",
    "Reinier de Ridder": "https://www.onefc.com/athletes/reinier-de-ridder/",
    "Brandon Vera": "https://www.onefc.com/athletes/brandon-vera/",
    "Ben Askren": "https://www.onefc.com/athletes/ben-askren/",
    "Regian Eersel": "https://www.onefc.com/athletes/regian-eersel/",
    "Roman Kryklia": "https://www.onefc.com/athletes/roman-kryklia/",
    "Kade Ruotolo": "https://www.onefc.com/athletes/kade-ruotolo/",
    "Tye Ruotolo": "https://www.onefc.com/athletes/tye-ruotolo/",
    "Mikey Musumeci": "https://www.onefc.com/athletes/mikey-musumeci/",
    "Fabricio Andrade": "https://www.onefc.com/athletes/fabricio-andrade/",
    "Kwon Won Il": "https://www.onefc.com/athletes/kwon-won-il/",
    "Roberto Soldic": "https://www.onefc.com/athletes/roberto-soldic/",
    "Zebaztian Kadestam": "https://www.onefc.com/athletes/zebaztian-kadestam/",
    "Ok Rae Yoon": "https://www.onefc.com/athletes/ok-rae-yoon/",
    "Xiong Jing Nan": "https://www.onefc.com/athletes/xiong-jing-nan/",
    "Denice Zamboanga": "https://www.onefc.com/athletes/denice-zamboanga/",
    "Garry Tonon": "https://www.onefc.com/athletes/garry-tonon/",
    "Akbar Abdullaev": "https://www.onefc.com/athletes/akbar-abdullaev/",
    "Ilya Freymanov": "https://www.onefc.com/athletes/ilya-freymanov/",
    "Shamil Gasanov": "https://www.onefc.com/athletes/shamil-gasanov/",
    "Shamil Erdogan": "https://www.onefc.com/athletes/shamil-erdogan/",
    "Martin Nguyen": "https://www.onefc.com/athletes/martin-nguyen/",
    "Seksan Or. Kwanmuang": "https://www.onefc.com/athletes/seksan-or-kwanmuang/",
    "Seksan Or Kwanmuang": "https://www.onefc.com/athletes/seksan-or-kwanmuang/",
    "Nico Carrillo": "https://www.onefc.com/athletes/nico-carrillo/",
    "Jonathan Di Bella": "https://www.onefc.com/athletes/jonathan-di-bella/",
    "Takeru Segawa": "https://www.onefc.com/athletes/takeru-segawa/",
    "Phetjeeja Lukjaoporongtom": "https://www.onefc.com/athletes/phetjeeja/",
    "Phetjeeja": "https://www.onefc.com/athletes/phetjeeja/",
    "Allycia Rodrigues": "https://www.onefc.com/athletes/allycia-helen-rodrigues/",
    "Allycia Helen Rodrigues": "https://www.onefc.com/athletes/allycia-helen-rodrigues/",
    "Seo Hee Ham": "https://www.onefc.com/athletes/seo-hee-ham/",
    "Muangthai PK Saenchai": "https://www.onefc.com/athletes/muangthai-p-k-saenchaimuaythaigym/",
    "Muangthai P.K.Saenchai": "https://www.onefc.com/athletes/muangthai-p-k-saenchaimuaythaigym/",
    "Shadow Singha Mawynn": "https://www.onefc.com/athletes/shadow-singha-mawynn/",
    "Suakim Pongsuphan P.K.": "https://www.onefc.com/athletes/suakim-pk-saenchai/",
    "Suakim PK Saenchai": "https://www.onefc.com/athletes/suakim-pk-saenchai/",
    "Yod-IQ Or.Pimolsri": "https://www.onefc.com/athletes/yod-iq-or-pimolsri/",
    "Aslamjon Ortikov": "https://www.onefc.com/athletes/aslamjon-ortikov/",
    "Nabil Anane": "https://www.onefc.com/athletes/nabil-anane/",
    "Kiamrian Abbasov": "https://www.onefc.com/athletes/kiamrian-abbasov/",
    "Vitaly Bigdash": "https://www.onefc.com/athletes/vitaly-bigdash/",
    "Thanh Le": "https://www.onefc.com/athletes/thanh-le/",
    "Alibeg Rasulov": "https://www.onefc.com/athletes/alibeg-rasulov/",
}


def slugify(text: str) -> str:
    s = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii").lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def name_key(text: str) -> str:
    s = unicodedata.normalize("NFKD", text or "").encode("ascii", "ignore").decode("ascii").lower()
    return " ".join(re.sub(r"[^a-z0-9]+", " ", s).split())


def to_webp(data: bytes, max_width: int = MAX_WIDTH) -> bytes:
    image = Image.open(io.BytesIO(data)).convert("RGBA")
    if image.width > max_width:
        ratio = max_width / image.width
        new_height = round(image.height * ratio)
        image = image.resize((max_width, new_height), Image.Resampling.LANCZOS)
    out = io.BytesIO()
    image.save(out, format="WEBP", quality=WEBP_QUALITY, method=4)
    return out.getvalue()


def load_sitemap_slugs(session: requests.Session) -> dict[str, str]:
    """slug -> full athlete URL from onefc.com sitemap."""
    try:
        resp = session.get(SITEMAP_URL, headers={"User-Agent": USER_AGENT}, timeout=TIMEOUT)
        if resp.status_code != 200:
            return {}
        urls = re.findall(r"<loc>(https://www\.onefc\.com/athletes/([^/<]+)/?)</loc>", resp.text)
        slug_map = {}
        for full_url, slug in urls:
            clean_slug = slug.strip("/").lower()
            slug_map[clean_slug] = full_url
            slug_map[name_key(clean_slug.replace("-", " "))] = full_url
        return slug_map
    except Exception as e:
        print(f"[warn] could not load sitemap: {e}")
        return {}


def extract_athlete_photo_url(session: requests.Session, athlete_url: str) -> str | None:
    try:
        resp = session.get(athlete_url, headers={"User-Agent": USER_AGENT}, timeout=TIMEOUT)
        if resp.status_code != 200:
            return None
        soup = BeautifulSoup(resp.text, "html.parser")
        og_img = soup.find("meta", property="og:image")
        if og_img and og_img.get("content") and "cdn.onefc.com" in og_img.get("content"):
            content = og_img.get("content")
            if "default" not in content.lower():
                return content
        for img in soup.find_all("img"):
            src = img.get("src") or img.get("data-src") or ""
            if "cdn.onefc.com" in src and ("hero" in src.lower() or "avatar" in src.lower()):
                if "default" not in src.lower():
                    return src
        return None
    except Exception:
        return None


def download_and_save(session: requests.Session, cdn_url: str, dest_path: Path) -> bool:
    try:
        resp = session.get(cdn_url, headers={"User-Agent": USER_AGENT}, timeout=TIMEOUT)
        if resp.status_code != 200 or len(resp.content) < 500:
            return False
        webp_bytes = to_webp(resp.content, max_width=MAX_WIDTH)
        dest_path.write_bytes(webp_bytes)
        return True
    except Exception:
        return False


def main():
    parser = argparse.ArgumentParser(description="Download official ONE fighter photos")
    parser.add_argument("--limit", type=int, default=150, help="Max photos to download")
    parser.add_argument("--all", action="store_true", help="Download photos for all available fighters")
    parser.add_argument("--workers", type=int, default=12, help="Parallel worker threads")
    args = parser.parse_args()

    PHOTOS_DIR.mkdir(parents=True, exist_ok=True)

    session = requests.Session()
    print("[info] Fetching ONE sitemap...")
    sitemap = load_sitemap_slugs(session)
    print(f"[info] Loaded {len(sitemap)} athlete entries from sitemap")

    fighters = list(csv.DictReader(FIGHTERS_PATH.open("r", encoding="utf-8-sig")))
    rankings = list(csv.DictReader(RANKINGS_PATH.open("r", encoding="utf-8-sig"))) if RANKINGS_PATH.exists() else []

    ranked_names = {r["fighter"] for r in rankings if r["fighter"]}

    def match_url(name: str, slug: str) -> str | None:
        if name in KNOWN_ALIASES:
            return KNOWN_ALIASES[name]
        nk = name_key(name)
        if slug in sitemap:
            return sitemap[slug]
        if nk in sitemap:
            return sitemap[nk]
        parts = nk.split()
        if len(parts) >= 2:
            first, last = parts[0], parts[-1]
            for s_slug, s_url in sitemap.items():
                if s_slug.startswith(first) and s_slug.endswith(last):
                    return s_url
        return None

    def priority(f: dict) -> tuple:
        name = f["name"]
        w = int(f.get("wins") or 0)
        l = int(f.get("losses") or 0)
        is_alias = name in KNOWN_ALIASES
        is_ranked = name in ranked_names
        is_belt = str(f.get("belt", "")).lower() == "true"
        is_active = f.get("status") == "active"
        has_url = match_url(name, f["slug"] or slugify(name)) is not None
        return (not has_url, not is_alias, not is_belt, not is_ranked, not is_active, -(w + l))

    sorted_fighters = sorted(fighters, key=priority)

    targets = []
    for f in sorted_fighters:
        name = f["name"]
        slug = f["slug"] or slugify(name)
        url = match_url(name, slug)
        if not url:
            continue
        dest_file = PHOTOS_DIR / f"{slug}.webp"
        targets.append((f, slug, url, dest_file))

    limit = len(targets) if args.all else args.limit
    to_process = targets[:limit]
    print(f"[info] Found {len(targets)} matchable fighters on onefc.com. Downloading up to {len(to_process)} with {args.workers} workers...")

    results = {}

    def process_one(item):
        fighter, slug, url, dest_path = item
        if dest_path.exists():
            return (fighter["name"], slug, fighter.get("headshot_url") or "", True)

        cdn_url = extract_athlete_photo_url(session, url)
        if not cdn_url:
            return (fighter["name"], slug, "", False)

        success = download_and_save(session, cdn_url, dest_path)
        return (fighter["name"], slug, cdn_url if success else "", success)

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        for name, slug, cdn_url, success in pool.map(process_one, to_process):
            results[name] = (slug, cdn_url, success)
            if success:
                print(f"[photo] OK {name} -> {slug}.webp")

    # Update fighters.csv
    updated_count = 0
    for f in fighters:
        slug = f["slug"] or slugify(f["name"])
        dest_file = PHOTOS_DIR / f"{slug}.webp"
        if dest_file.exists():
            f["image_url"] = f"{PHOTOS_WEB_PREFIX}{slug}.webp"
            if f["name"] in results and results[f["name"]][1]:
                f["headshot_url"] = results[f["name"]][1]
            updated_count += 1
        elif f["name"] in results and results[f["name"]][1]:
            f["headshot_url"] = results[f["name"]][1]
        # Also ensure profile_url points to real onefc.com page if known
        known_url = match_url(f["name"], slug)
        if known_url:
            f["profile_url"] = known_url

    with FIGHTERS_PATH.open("w", encoding="utf-8", newline="") as h:
        w = csv.DictWriter(h, fieldnames=list(fighters[0].keys()))
        w.writeheader()
        w.writerows(fighters)

    print(f"[info] Done! {updated_count} fighters now have local photos in {PHOTOS_DIR} and registered in {FIGHTERS_PATH}")


if __name__ == "__main__":
    main()
