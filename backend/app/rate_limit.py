"""Rate limiting: who counts as "the same visitor".

Behind a proxy the connection comes from the proxy, not from the visitor, so keying on the connection address would put
every visitor in one bucket. The proxy tells us who it saw in X-Forwarded-For, but only the proxies we run or trust can
be believed: each one appends the address it saw to the end of the list, while everything to the left of them was
written by the client and can say anything.

TRUSTED_PROXY_HOPS is how many proxies sit between the visitor and this app. The key is then the entry that many places
from the right, the address the outermost trusted proxy saw. The default is 0: ignore the header and use the connection
address, which is the right answer when nothing sits in front of the app (and is what the app did before this setting).

Do not point uvicorn's --forwarded-allow-ips at "*" to get the same result: uvicorn then takes the first entry of the
list, and the first entry is the one a client can forge.

Set RATE_LIMIT_DEBUG=1 to log the connection address, the header and the chosen key for the first requests, to find out
how many proxies there really are. It logs visitors' addresses, so leave it off otherwise.
"""

from __future__ import annotations

import ipaddress
import logging
import os

from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request

logger = logging.getLogger(__name__)

DEBUG_LOG_LIMIT = 50


def _hops_from_env() -> int:
    raw = os.getenv("TRUSTED_PROXY_HOPS", "0").strip()
    try:
        return max(int(raw), 0)
    except ValueError:
        logger.warning("TRUSTED_PROXY_HOPS=%r is not a whole number; using 0 (the connection address).", raw)
        return 0


TRUSTED_PROXY_HOPS = _hops_from_env()
_debug_budget = DEBUG_LOG_LIMIT if os.getenv("RATE_LIMIT_DEBUG", "").strip().lower() in {"1", "true", "yes"} else 0


def client_ip(request: Request) -> str:
    """The limiter key: the visitor's address as seen by the outermost trusted proxy, else the connection address."""
    peer = get_remote_address(request)
    key = peer
    forwarded = request.headers.get("x-forwarded-for", "")

    if TRUSTED_PROXY_HOPS > 0:
        entries = [entry.strip() for entry in forwarded.split(",") if entry.strip()]
        # Fewer entries than proxies means the request did not come through the chain we expect: do not guess.
        if len(entries) >= TRUSTED_PROXY_HOPS:
            candidate = entries[-TRUSTED_PROXY_HOPS]
            try:
                ipaddress.ip_address(candidate)
                key = candidate
            except ValueError:
                pass  # not an address: not a usable key

    global _debug_budget
    if _debug_budget > 0:
        _debug_budget -= 1
        logger.info("rate limit key=%s peer=%s x-forwarded-for=%r hops=%d", key, peer, forwarded[:200], TRUSTED_PROXY_HOPS)
    return key


limiter = Limiter(key_func=client_ip)
