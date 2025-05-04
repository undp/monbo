from typing import Literal, Optional

from app.utils.polygons import generate_polygon_from_coordinates
from pydantic import BaseModel

from .polygons import Coordinates, PointDetails, PolygonDetails


class Polygon(BaseModel):
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
    polygon: Polygon | None


class InputFarmData(BaseModel):
    id: Optional[str | int] = None
    producerName: str
    productionDate: str
    productionQuantity: int | float | str
    productionQuantityUnit: str
    country: str
    region: str
    farmCoordinates: str
    cropType: str
    association: Optional[str] = None
    area: int | float | str
    documents: list[Document]


class PreProcessedFarmData(BaseModel):
    id: str
    producerName: str
    productionDate: str
    productionQuantity: float
    productionQuantityUnit: str
    country: str
    region: str
    farmCoordinates: list[Coordinates]
    cropType: str
    association: Optional[str] = None
    area: float
    documents: list[Document]


class FarmPolygon(BaseModel):
    id: str
    type: Literal["polygon", "point"]
    path: Optional[list[Coordinates]] = None
    center: Optional[Coordinates] = None

    def get_polygon(self):
        (_, polygon) = generate_polygon_from_coordinates(
            self.path if self.type == "polygon" else [self.center]
        )
        return polygon


class FarmWithPolygon(FarmPolygon):
    polygon: Polygon
