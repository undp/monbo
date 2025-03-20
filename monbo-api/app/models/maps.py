from pydantic import BaseModel


class BaseMapData(BaseModel):
    id: int
    name: str
    alias: str
    baseline: int
    comparedAgainst: int
    coverage: str
    details: str
    resolution: str
    contentDate: str
    updateFrequency: str
    source: str
    disclaimer: str


class MapData(BaseMapData):
    asset_name: str
