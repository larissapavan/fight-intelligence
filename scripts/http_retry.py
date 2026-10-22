"""GET with a few retries, for the sources that were fetched with one bare requests.get.

A single timeout or 503 from ufc.com, roster.watch or statleaders.ufc.com used to cost the whole step for the day (the
step then left its files untouched, which is safe but stale). Retrying server errors and timeouts a few times, with a
growing wait, makes that rare. A 4xx other than 429 means the page moved or is blocked: retrying will not help, so it
fails at once.
"""

from __future__ import annotations

import time

import requests

RETRIES = 3
RETRY_STATUSES = {429, 500, 502, 503, 504}


def get_with_retry(
    url: str, *, headers: dict | None = None, timeout: float = 60, retries: int = RETRIES, wait: float = 5.0,
    sleep=time.sleep, get=requests.get,
) -> requests.Response:
    last_error: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            response = get(url, headers=headers, timeout=timeout)
            if response.status_code in RETRY_STATUSES:
                last_error = requests.HTTPError(f"{url}: HTTP {response.status_code}", response=response)
            else:
                response.raise_for_status()
                return response
        except (requests.ConnectionError, requests.Timeout) as exc:
            last_error = exc
        if attempt < retries:
            sleep(wait * attempt)
    raise RuntimeError(f"Failed to fetch {url} after {retries} attempts") from last_error
