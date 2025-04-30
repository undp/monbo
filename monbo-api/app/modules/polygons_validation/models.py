from typing import Literal

from app.models.polygons import Coordinates
from pydantic import BaseModel


class OverlapData(BaseModel):
    area: float
    center: Coordinates
    paths: list[list[Coordinates]]
    percentage: float
    criticality: Literal["HIGH", "MEDIUM"]


class InvalidGeometryInconsistencyData(BaseModel):
    reason: str


class PolygonInconsistency(BaseModel):
    type: str
    farmIds: list[str]
    data: OverlapData | InvalidGeometryInconsistencyData | None


class PolygonError(BaseModel):
    id: str
    error: str


class FarmResult(BaseModel):
    farmId: str
    status: Literal["VALID", "VALID_MANUALLY", "NOT_VALID"]


class GetOverlappingPolygonsResponse(BaseModel):
    farmResults: list[FarmResult]
    inconsistencies: list[PolygonInconsistency]
