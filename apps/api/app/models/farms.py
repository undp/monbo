from typing import Annotated, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field
from shapely.geometry import Polygon

from .polygons import Coordinates, PointDetails, PolygonDetails


class PointSummary(BaseModel):
    """A farm given as a point: always a center, a radius and the area they cover."""

    type: Literal["point"]
    details: PointDetails
    area: float


class PolygonShapeSummary(BaseModel):
    """A farm given as a polygon; details and area are null when the geometry is
    empty."""

    type: Literal["polygon"]
    details: PolygonDetails | None
    area: float | None


# A farm's geometry, discriminated by `type` so clients get the exact shape of each
# kind (the generated frontend types rely on it).
PolygonSummary = Annotated[
    PointSummary | PolygonShapeSummary, Field(discriminator="type")
]


class Document(BaseModel):
    name: str
    url: str


class FarmData(BaseModel):
    # Responses always include defaulted fields: mark them required in the OpenAPI.
    model_config = ConfigDict(json_schema_serialization_defaults_required=True)

    id: str
    producer: str
    producerId: str
    cropType: str
    productionDate: str
    production: float
    productionQuantityUnit: str
    country: str
    region: Optional[str] = None
    association: Optional[str] = None
    documents: list[Document]
    polygon: PolygonSummary


class InputFarmData(BaseModel):
    id: Optional[str | int] = None
    producerName: str
    productionDate: str
    productionQuantity: int | float | str
    productionQuantityUnit: str
    country: str
    region: Optional[str] = None
    coordinatesFormat: Literal["WKT", "GeoJSON"]
    geometryType: Literal["Point", "Polygon"]
    farmCoordinates: str
    cropType: str
    association: Optional[str] = None
    area: Optional[int | float | str] = None
    documents: list[Document]


class PreProcessedFarmData(BaseModel):
    id: str
    producerName: str
    productionDate: str
    productionQuantity: float
    productionQuantityUnit: str
    country: str
    region: Optional[str] = None
    coordinatesFormat: Literal["WKT", "GeoJSON"]
    geometryType: Literal["Point", "Polygon"]
    farmCoordinates: list[Coordinates]
    cropType: str
    association: Optional[str] = None
    area: float
    documents: list[Document]


class FarmPolygonDetailData(BaseModel):
    id: str
    type: Literal["polygon", "point"]
    details: PolygonDetails | PointDetails | None


class FarmPolygonDetailDataWithPolygon(FarmPolygonDetailData):
    polygon: Polygon

    model_config = {"arbitrary_types_allowed": True}
