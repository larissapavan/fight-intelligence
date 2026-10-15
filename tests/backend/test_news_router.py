import io
import json

import pytest

from backend.app.services import news_service

PAYLOAD = {
    "articles": [
        {
            "headline": "Older story",
            "description": "Older summary",
            "published": "2026-10-13T12:00:00Z",
            "links": {"web": {"href": "https://www.espn.com/ufc/story/_/id/1/older"}},
            "images": [{"url": "https://a.espncdn.com/photo/older.jpg"}],
        },
        {
            "headline": "Fresh clip",
            "type": "Media",
            "published": "2026-10-15T12:00:00Z",
            "links": {"web": {"href": "https://www.espn.com/video/clip/_/id/2/fresh"}},
        },
        {"headline": "No link, skipped", "published": "2026-10-14T12:00:00Z", "links": {}},
        {"headline": "Insecure link, skipped", "links": {"web": {"href": "http://example.com/x"}}},
    ]
}


@pytest.fixture(autouse=True)
def fake_espn(monkeypatch):
    """Never reach the real ESPN feed from tests, and start every test with an empty cache."""
    news_service._cache.update({"fetched_at": 0.0, "items": None})
    monkeypatch.setattr(news_service, "urlopen", lambda *args, **kwargs: io.BytesIO(json.dumps(PAYLOAD).encode()))
    yield
    news_service._cache.update({"fetched_at": 0.0, "items": None})


def test_news_lists_newest_first_and_drops_unusable_articles(client):
    body = client.get("/news").json()

    assert body["source_name"] == "ESPN"
    assert [item["title"] for item in body["items"]] == ["Fresh clip", "Older story"]
    assert body["items"][0]["kind"] == "video"
    assert body["items"][1]["kind"] == "story"
    assert body["items"][1]["image_url"] == "https://a.espncdn.com/photo/older.jpg"


def test_news_limit_is_respected(client):
    assert len(client.get("/news", params={"limit": 1}).json()["items"]) == 1


def test_news_survives_espn_being_down(client, monkeypatch):
    def down(*args, **kwargs):
        raise OSError("offline")

    monkeypatch.setattr(news_service, "urlopen", down)
    response = client.get("/news")
    assert response.status_code == 200
    assert response.json()["items"] == []
