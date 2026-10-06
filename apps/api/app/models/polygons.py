from pydantic import BaseModel


class Point(BaseModel):
    x: float
    y: float


class Coordinates(BaseModel):
    lat: float
    lng: float


class PolygonDetails(BaseModel):
    center: Coordinates
    path: list[Coordinates]


class PointDetails(BaseModel):
    center: Coordinates
    radius: float
