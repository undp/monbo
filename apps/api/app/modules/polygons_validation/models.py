from typing import Annotated, Literal

from pydantic import BaseModel, Field

from app.models.polygons import Coordinates


class OverlapData(BaseModel):
    area: float
    center: Coordinates
    paths: list[list[Coordinates]]
    percentage: float
    criticality: Literal["HIGH", "MEDIUM"]


class InvalidGeometryInconsistencyData(BaseModel):
    reason: str


class OverlapInconsistency(BaseModel):
    type: Literal["overlap"]
    farmIds: list[str]
    data: OverlapData


class InvalidGeometryInconsistency(BaseModel):
    type: Literal["invalid_geometry"]
    farmIds: list[str]
    data: InvalidGeometryInconsistencyData


class EmptyPolygonInconsistency(BaseModel):
    type: Literal["empty_polygon"]
    farmIds: list[str]
    data: None


# Discriminated on `type`, so the generated frontend type narrows `data` by kind.
PolygonInconsistency = Annotated[
    OverlapInconsistency | InvalidGeometryInconsistency | EmptyPolygonInconsistency,
    Field(discriminator="type"),
]


class PolygonError(BaseModel):
    id: str
    error: str


class FarmResult(BaseModel):
    farmId: str
    status: Literal["VALID", "VALID_MANUALLY", "NOT_VALID"]


class PolygonInconsistenciesResponse(BaseModel):
    farmResults: list[FarmResult]
    inconsistencies: list[PolygonInconsistency]
