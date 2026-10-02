from typing import Annotated

from pydantic import BaseModel, StringConstraints

# An ISO 3166-1 alpha-2 code, uppercase, as the country registry stores them.
COUNTRY_CODE_PATTERN = r"^[A-Z]{2}$"
CountryCode = Annotated[str, StringConstraints(pattern=COUNTRY_CODE_PATTERN)]


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
    # The layer's country: ids are numbered within each country, so (country, id)
    # identifies it. None in the legacy flat layout, where ids are global.
    country: str | None = None
    version: int
    pixelSize: float


class MapData(BaseMapData):
    raster_filename: str
