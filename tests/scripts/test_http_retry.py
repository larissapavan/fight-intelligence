import pytest
import requests

from scripts.http_retry import get_with_retry


class Reply:
    def __init__(self, status):
        self.status_code = status

    def raise_for_status(self):
        if self.status_code >= 400:
            raise requests.HTTPError(f"HTTP {self.status_code}", response=self)


def sequence(*steps):
    """A fake requests.get that returns or raises each step in turn, and counts the calls."""
    calls = []

    def get(url, headers=None, timeout=None):
        calls.append(url)
        step = steps[min(len(calls), len(steps)) - 1]
        if isinstance(step, Exception):
            raise step
        return Reply(step)

    get.calls = calls
    return get


def test_a_server_error_is_retried_until_the_page_answers():
    get, waits = sequence(503, requests.Timeout("slow"), 200), []
    assert get_with_retry("https://x.test", get=get, sleep=waits.append, wait=2).status_code == 200
    assert len(get.calls) == 3 and waits == [2, 4]  # the wait grows


def test_it_gives_up_after_the_last_attempt_and_says_why():
    get = sequence(503)
    with pytest.raises(RuntimeError, match="after 3 attempts") as caught:
        get_with_retry("https://x.test", get=get, sleep=lambda _: None)
    assert "503" in str(caught.value.__cause__) and len(get.calls) == 3


def test_a_missing_or_blocked_page_fails_at_once_because_retrying_cannot_help():
    for status in (403, 404):
        get = sequence(status)
        with pytest.raises(requests.HTTPError):
            get_with_retry("https://x.test", get=get, sleep=lambda _: None)
        assert len(get.calls) == 1
