from pydantic import BaseModel


class BaseMapData(BaseModel):
    id: int
    name: str
    alias: str
    baseline: int
    comparedAgainst: int
    coverage: str
    source: str
    resolution: str
    contentDate: str
    updateFrequency: str
    reference: str
    considerations: str


class MapData(BaseMapData):
    raster_filename: str
