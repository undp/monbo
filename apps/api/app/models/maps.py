from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

# An ISO 3166-1 alpha-2 code, uppercase, as the country registry stores them.
COUNTRY_CODE_PATTERN = r"^[A-Z]{2}$"
CountryCode = Annotated[str, StringConstraints(pattern=COUNTRY_CODE_PATTERN)]


CATEGORY_ID_DESCRIPTION = (
    "The id of the layer's category in its country (see `GET /categories`). "
    'A layer whose index entry has no category belongs to the built-in "deforestation", '
    "which every country has."
)


class BaseMapData(BaseModel):
    # Responses always include defaulted fields: mark them required in the OpenAPI.
    model_config = ConfigDict(json_schema_serialization_defaults_required=True)

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
    # Layers whose category is disabled or doesn't resolve are not listed.
    categoryId: str = Field(description=CATEGORY_ID_DESCRIPTION)
    version: int
    pixelSize: float


class MapData(BaseMapData):
    raster_filename: str
