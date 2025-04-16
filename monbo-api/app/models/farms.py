from typing import Literal, Optional

from app.utils.polygons import generate_polygon_from_coordinates
from pydantic import BaseModel

from .polygons import Coordinates, PointDetails, PolygonDetails


class Polygon(BaseModel):
    type: Literal["polygon", "point"]
    details: PolygonDetails | PointDetails
    area: float


class FarmData(BaseModel):
    id: str
    producer: str
    producerId: str
    cropType: str
    productionDate: str
    production: float
    productionQuantityUnit: str
    country: str
    region: str
    association: str
    polygon: Polygon | None


class UnprocessedFarmData(BaseModel):
    id: str
    producerName: str
    productionDate: str
    productionQuantity: float
    productionQuantityUnit: str
    country: str
    region: str
    farmCoordinates: str
    cropType: str
    association: str


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
