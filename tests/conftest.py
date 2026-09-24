import pytest
from fastapi.testclient import TestClient

from backend.app.main import app


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(scope="session")
def two_fighter_names(client: TestClient) -> tuple[str, str]:
    response = client.get("/fighters")
    fighters = response.json()
    assert len(fighters) >= 2, "Need at least two fighters in the catalog to run matchup tests."
    return fighters[0]["name"], fighters[1]["name"]
