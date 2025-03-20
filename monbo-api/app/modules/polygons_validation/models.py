from typing import Literal
from pydantic import BaseModel
from app.models.polygons import Coordinates


class Overlap(BaseModel):
    area: float
    center: Coordinates
    path: list[Coordinates]
    percentage: float
    criticality: Literal["HIGH", "MEDIUM"]


class PolygonInconsistency(BaseModel):
    type: str
    farmIds: list[str]
    data: Overlap


class PolygonError(BaseModel):
    id: str
    error: str


class FarmResult(BaseModel):
    farmId: str
    status: Literal["VALID", "VALID_MANUALLY", "NOT_VALID"]


class GetOverlappingPolygonsResponse(BaseModel):
    farmResults: list[FarmResult]
    inconsistencies: list[PolygonInconsistency]
