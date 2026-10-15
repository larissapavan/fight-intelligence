from __future__ import annotations

import json
import logging
import time
from urllib.error import URLError
from urllib.request import Request, urlopen

logger = logging.getLogger(__name__)

ESPN_NEWS_URL = "https://site.api.espn.com/apis/site/v2/sports/mma/ufc/news?limit={limit}"
USER_AGENT = "ufcpredictor/1.0 (personal project; reads ESPN's public UFC news feed)"
CACHE_SECONDS = 20 * 60
FETCH_TIMEOUT_SECONDS = 6
MAX_ITEMS = 12

_cache: dict = {"fetched_at": 0.0, "items": None}


def get_latest_news(limit: int = 6) -> list[dict]:
    """The latest UFC headlines from ESPN, newest first.

    Cached for 20 minutes so visitors never hit ESPN directly. If ESPN is unreachable the last good copy is served
    (stale beats an empty card); with no copy at all the list is empty and the page simply hides the card."""
    now = time.monotonic()
    if _cache["items"] is None or now - _cache["fetched_at"] > CACHE_SECONDS:
        try:
            _cache["items"] = _fetch_news()
            _cache["fetched_at"] = now
        except (URLError, TimeoutError, ValueError, OSError):
            logger.warning("Could not refresh the ESPN news feed.", exc_info=True)
            _cache["fetched_at"] = now - CACHE_SECONDS + 60  # retry in a minute instead of on every request
    return (_cache["items"] or [])[: max(1, limit)]


def _fetch_news() -> list[dict]:
    request = Request(ESPN_NEWS_URL.format(limit=MAX_ITEMS), headers={"User-Agent": USER_AGENT})
    with urlopen(request, timeout=FETCH_TIMEOUT_SECONDS) as response:  # noqa: S310 - fixed https URL
        payload = json.load(response)

    items = []
    for article in payload.get("articles", []):
        url = (article.get("links", {}).get("web", {}) or {}).get("href")
        headline = (article.get("headline") or "").strip()
        if not url or not headline or not url.startswith("https://"):
            continue
        images = article.get("images") or []
        items.append(
            {
                "title": headline,
                "summary": (article.get("description") or "").strip() or None,
                "url": url,
                "image_url": next((image.get("url") for image in images if image.get("url")), None),
                "published": article.get("published"),
                "kind": "video" if article.get("type") == "Media" or "/video/" in url else "story",
            }
        )
    items.sort(key=lambda item: item["published"] or "", reverse=True)
    return items
