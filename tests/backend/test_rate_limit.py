"""The rate limit must key on the visitor, and must not let a visitor pick their own key."""

import pytest
from starlette.requests import Request

from backend.app import rate_limit


def request(forwarded: str | None = None, peer: str = "10.0.0.7") -> Request:
    headers = [(b"x-forwarded-for", forwarded.encode())] if forwarded is not None else []
    return Request({"type": "http", "method": "GET", "path": "/", "headers": headers, "client": (peer, 5000)})


@pytest.fixture
def hops(monkeypatch):
    def set_hops(count: int) -> None:
        monkeypatch.setattr(rate_limit, "TRUSTED_PROXY_HOPS", count)

    return set_hops


def test_by_default_the_header_is_ignored_and_the_connection_address_is_the_key(hops):
    hops(0)
    assert rate_limit.client_ip(request("203.0.113.9")) == "10.0.0.7"
    assert rate_limit.client_ip(request()) == "10.0.0.7"


def test_one_trusted_proxy_the_key_is_the_last_entry_the_proxy_appended(hops):
    hops(1)
    assert rate_limit.client_ip(request("198.51.100.4")) == "198.51.100.4"


def test_a_client_cannot_choose_its_key_by_sending_the_header_itself(hops):
    """The proxy appends the real address after whatever the client wrote; only the end of the list counts."""
    hops(1)
    forged = "1.2.3.4, 5.6.7.8, 198.51.100.4"  # the client sent the first two, the proxy added the last
    assert rate_limit.client_ip(request(forged)) == "198.51.100.4"


def test_two_proxies_the_key_is_the_visitor_the_first_proxy_saw(hops):
    hops(2)
    # visitor, then the address the second proxy saw (the first proxy), with a forged entry the client added at the start
    assert rate_limit.client_ip(request("1.2.3.4, 198.51.100.4, 192.0.2.1")) == "198.51.100.4"


def test_fewer_entries_than_proxies_falls_back_to_the_connection_address(hops):
    hops(2)
    assert rate_limit.client_ip(request("198.51.100.4")) == "10.0.0.7"  # the chain is not what we expected
    assert rate_limit.client_ip(request()) == "10.0.0.7"
    assert rate_limit.client_ip(request("")) == "10.0.0.7"


@pytest.mark.parametrize("junk", ["not-an-ip", "unknown", "999.1.1.1", "1.2.3.4:80"])
def test_an_entry_that_is_not_an_address_is_never_used_as_a_key(hops, junk):
    hops(1)
    assert rate_limit.client_ip(request(junk)) == "10.0.0.7"


def test_ipv6_and_spaces_are_handled(hops):
    hops(1)
    assert rate_limit.client_ip(request("1.2.3.4 ,  2001:db8::1 ")) == "2001:db8::1"


@pytest.mark.parametrize(("value", "expected"), [("2", 2), (" 1 ", 1), ("0", 0), ("-3", 0), ("two", 0), ("", 0)])
def test_the_setting_is_read_safely_from_the_environment(monkeypatch, value, expected):
    monkeypatch.setenv("TRUSTED_PROXY_HOPS", value)
    assert rate_limit._hops_from_env() == expected


def test_the_limiter_uses_this_key(hops):
    hops(1)
    assert rate_limit.limiter._key_func(request("198.51.100.4")) == "198.51.100.4"


def test_one_visitor_hitting_the_limit_does_not_block_another_behind_the_same_proxy(client, hops):
    hops(1)
    limit = 60  # /track-record allows 60 a minute
    greedy = {"X-Forwarded-For": "203.0.113.50"}
    statuses = [client.get("/track-record", headers=greedy).status_code for _ in range(limit + 1)]
    assert statuses[:limit] == [200] * limit and statuses[-1] == 429

    assert client.get("/track-record", headers={"X-Forwarded-For": "203.0.113.51"}).status_code == 200  # someone else
    # Forging the start of the list does not buy a fresh allowance: the proxy's own entry is still the same.
    forged = {"X-Forwarded-For": "9.9.9.9, 203.0.113.50"}
    assert client.get("/track-record", headers=forged).status_code == 429
