from pydantic import BaseModel


class DataInfoResponse(BaseModel):
    last_updated: str | None = None
    fighters_count: int
    events_count: int
    fights_count: int
    sources: list[str]
