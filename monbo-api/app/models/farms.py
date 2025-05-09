from typing import Literal, Optional
from pydantic import BaseModel
from shapely.geometry import Polygon
from .polygons import Coordinates, PointDetails, PolygonDetails


class PolygonSummary(BaseModel):
    type: Literal["polygon", "point"]
    details: PolygonDetails | PointDetails | None
    area: float | None


class Document(BaseModel):
    name: str
    url: str


class FarmData(BaseModel):
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
    polygon: PolygonSummary | None


class InputFarmData(BaseModel):
    id: Optional[str | int] = None
    producerName: str
    productionDate: str
    productionQuantity: int | float | str
    productionQuantityUnit: str
    country: str
    region: Optional[str] = None
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
