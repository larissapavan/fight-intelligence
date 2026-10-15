from typing import Literal

from pydantic import BaseModel


class NewsItem(BaseModel):
    title: str
    summary: str | None = None
    url: str
    image_url: str | None = None
    published: str | None = None
    kind: Literal["story", "video"] = "story"


class NewsResponse(BaseModel):
    source_name: str
    source_url: str
    items: list[NewsItem]
