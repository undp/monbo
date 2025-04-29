from pydantic import BaseModel


class BaseMapData(BaseModel):
    id: int
    name: str | None
    alias: str | None
    baseline: int | None
    comparedAgainst: int | None
    coverage: str | None
    source: str | None
    resolution: str | None
    contentDate: str | None
    updateFrequency: str | None
    publishDate: str | None
    references: list[str]
    considerations: str | None
    availableCountriesCodes: list[str]


class MapData(BaseMapData):
    raster_filename: str
