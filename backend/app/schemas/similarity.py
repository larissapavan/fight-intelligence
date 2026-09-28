from pydantic import BaseModel


class SimilarFighter(BaseModel):
    name: str
    similarity: float
    division: str | None = None
    wins: int
    losses: int
    draws: int
    image_url: str | None = None
