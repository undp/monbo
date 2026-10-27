from pydantic import BaseModel


class Point(BaseModel):
    x: float
    y: float


class Coordinates(BaseModel):
    lat: float
    lng: float


class PolygonPart(BaseModel):
    """One polygon of a farm: its outer ring and its holes, each a closed ring. The
    API returns the exterior counter-clockwise and the holes clockwise."""

    exterior: list[Coordinates]
    holes: list[list[Coordinates]]


class PolygonDetails(BaseModel):
    # A point inside the farm: its centroid when that lies inside it
    center: Coordinates
    # One part for a polygon, one per polygon for a MultiPolygon: still one farm
    parts: list[PolygonPart]


class PointDetails(BaseModel):
    center: Coordinates
    radius: float
