"""Admin contracts: layers, layer categories and ingestion jobs. The frontend's types
are generated from the API's OpenAPI (`pnpm contracts`), so these models are the
single source.

Field names follow the layers index (`<country>/index.json` under MAPS_ROOT), which
is what these endpoints read and write. A layer belongs to the country of the admin
session that created it, so there is no countries field. Categories use the camelCase
names of the public `LayerCategory` (`GET /categories`), so the admin and the public
app read one shape.
"""

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.categories import (
    CategoryIcon,
    CategoryPolarity,
    LocalizedText,
    ResultLabels,
)
from app.models.maps import CATEGORY_ID_DESCRIPTION
from app.modules.layers.categories import (
    CATEGORY_ID_PATTERN,
    COLOR_PATTERN,
    DESCRIPTION_MAX_LENGTH,
    LABEL_MAX_LENGTH,
    NAME_MAX_LENGTH,
    PIXEL_SIZE_MAX,
    THRESHOLD_MAX,
    THRESHOLD_MIN,
    YEAR_MAX,
    YEAR_MIN,
    CategoryIssue,
    LayerIssue,
    years_problem,
)

YEAR = Field(default=None, ge=YEAR_MIN, le=YEAR_MAX)
SHORT_TEXT = Field(default=None, max_length=500)


class _Strict(BaseModel):
    # Unknown fields are an error, so a client can't believe it changed `enabled`
    # or `version` through the wrong endpoint.
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class LayerAttributes(_Strict):
    """What `metadata/attributes/<lang>/*.json` holds for one language."""

    name: str = Field(min_length=1, max_length=200)
    alias: str = Field(min_length=1, max_length=100)
    coverage: str | None = SHORT_TEXT
    source: str | None = SHORT_TEXT
    resolution: str | None = SHORT_TEXT
    contentDate: str | None = SHORT_TEXT
    updateFrequency: str | None = SHORT_TEXT
    publishDate: str | None = SHORT_TEXT


class LocalizedAttributes(_Strict):
    en: LayerAttributes
    es: LayerAttributes


class LocalizedConsiderations(_Strict):
    """Markdown per language; empty or missing means no considerations."""

    en: str | None = Field(default=None, max_length=20_000)
    es: str | None = Field(default=None, max_length=20_000)


class LayerInput(_Strict):
    """Body of `POST /admin/layers` and `PUT /admin/layers/{id}`."""

    category_id: str = Field(
        pattern=CATEGORY_ID_PATTERN,
        description=(
            "A category of the session's country. Its `temporal` decides the years: "
            "both required when it is temporal, both null when it isn't."
        ),
    )
    pixel_size: float = Field(
        gt=0, le=PIXEL_SIZE_MAX, description="Pixel size in meters"
    )
    baseline: int | None = YEAR
    compared_against: int | None = YEAR
    references: list[str] = Field(default_factory=list, max_length=20)
    attributes: LocalizedAttributes
    considerations: LocalizedConsiderations = Field(
        default_factory=LocalizedConsiderations
    )

    @field_validator("references")
    @classmethod
    def _http_references(cls, references: list[str]) -> list[str]:
        cleaned = [reference.strip() for reference in references if reference.strip()]
        for reference in cleaned:
            if (
                not reference.startswith(("http://", "https://"))
                or len(reference) > 2000
            ):
                raise ValueError(f"'{reference[:80]}' is not an http(s) URL")
        return cleaned

    @model_validator(mode="after")
    def _years(self) -> "LayerInput":
        # The same rule the public listing applies to the index (`years_fit`).
        problem = years_problem(self.baseline, self.compared_against)
        if problem is not None:
            raise ValueError(problem)
        return self


class EnabledInput(_Strict):
    """Body of `PATCH /admin/layers/{id}`."""

    enabled: bool


class StoredAttributes(BaseModel):
    """Attributes as found on disk; lenient, since older files may lack fields."""

    # Responses always include defaulted fields: mark them required in the OpenAPI.
    model_config = ConfigDict(json_schema_serialization_defaults_required=True)

    name: str | None = None
    alias: str | None = None
    coverage: str | None = None
    source: str | None = None
    resolution: str | None = None
    contentDate: str | None = None
    updateFrequency: str | None = None
    publishDate: str | None = None


class AdminLayer(BaseModel):
    id: int
    category_id: str = Field(description=CATEGORY_ID_DESCRIPTION)
    category_issue: CategoryIssue | None = Field(
        description=(
            "Why the layer's category doesn't resolve in its country (the layer is "
            "then hidden from the public app), or null when it does."
        )
    )
    category_enabled: bool = Field(
        description="Whether the layer's category resolves and is enabled"
    )
    layer_issue: LayerIssue | None = Field(
        description=(
            "Why the layer can't be public even with a usable category: an index "
            "field has an invalid type (`invalid_fields`), its years don't fit the "
            "category's `temporal` (`years_mismatch`), or it has no raster "
            "(`missing_raster`). Null when nothing stops it."
        )
    )
    pixel_size: float | None = Field(
        description="Pixel size in meters; null when the index holds an invalid value"
    )
    baseline: int | None
    compared_against: int | None
    references: list[str]
    enabled: bool
    version: int | None = Field(
        description="Raster version; null when the index holds an invalid value"
    )
    raster_filename: str | None
    has_raster: bool
    attributes: dict[str, StoredAttributes | None]
    considerations: dict[str, str | None]


# --- Layer categories -------------------------------------------------------------


class CategoryNameInput(_Strict):
    es: str = Field(min_length=1, max_length=NAME_MAX_LENGTH)
    en: str = Field(min_length=1, max_length=NAME_MAX_LENGTH)


class CategoryDescriptionInput(_Strict):
    es: str = Field(default="", max_length=DESCRIPTION_MAX_LENGTH)
    en: str = Field(default="", max_length=DESCRIPTION_MAX_LENGTH)


class CategoryLabelInput(_Strict):
    es: str = Field(min_length=1, max_length=LABEL_MAX_LENGTH)
    en: str = Field(min_length=1, max_length=LABEL_MAX_LENGTH)


class CategoryResultLabelsInput(_Strict):
    ok: CategoryLabelInput = Field(description="Result without findings")
    flagged: CategoryLabelInput = Field(description="Result with findings")


class CategoryInput(_Strict):
    """Body of `PUT /admin/categories/{id}`: every editable field of a category.
    `enabled` changes only through `PATCH`."""

    name: CategoryNameInput
    description: CategoryDescriptionInput = Field(
        default_factory=CategoryDescriptionInput
    )
    icon: CategoryIcon
    color: str = Field(pattern=COLOR_PATTERN, description="Hex color, #rrggbb")
    polarity: CategoryPolarity = Field(
        description=(
            "`avoid`: coinciding with the layer is a finding. `required`: not "
            "coinciding is. Can't change while the category has published layers."
        )
    )
    thresholdPercentage: float | None = Field(
        default=None,
        ge=THRESHOLD_MIN,
        le=THRESHOLD_MAX,
        description="The category's own threshold; null uses the global one",
    )
    resultLabels: CategoryResultLabelsInput
    temporal: bool = Field(
        description=(
            "Whether its layers have a baseline and a comparison year. Can't change "
            "while the category has any layer."
        )
    )


class CategoryCreate(CategoryInput):
    """Body of `POST /admin/categories`: no `id`. The API makes it from the Spanish
    name, unique in the country and never reused, and returns it."""


class AdminCategory(BaseModel):
    """A category as the admin sees it: like `LayerCategory`, with its own threshold
    (not resolved), its state and how many layers use it."""

    # Responses always include defaulted fields: mark them required in the OpenAPI.
    model_config = ConfigDict(json_schema_serialization_defaults_required=True)

    id: str
    name: LocalizedText
    description: LocalizedText
    icon: CategoryIcon
    color: str
    polarity: CategoryPolarity
    thresholdPercentage: float | None = Field(
        description="The category's own threshold; null when it uses the global one"
    )
    resultLabels: ResultLabels
    temporal: bool
    enabled: bool
    layerCount: int = Field(description="Layers of the country in this category")
    publishedLayerCount: int = Field(description="Of those, the enabled ones")


class AdminCategories(BaseModel):
    """Body of `GET /admin/categories`."""

    categories: list[AdminCategory] = Field(
        description=(
            "Every category of the session's country, enabled or not, in the order "
            "`GET /categories` uses. Rejected entries are not listed."
        )
    )
    readable: bool = Field(
        description="False when the country's categories file can't be read or parsed"
    )
    errors: list[str] = Field(
        description="The problems of the country's categories file, one per entry"
    )


# --- Ingestion jobs (the JSON stored under the layers root's .jobs/) ---------------


class JobIssue(BaseModel):
    """An error or warning with a stable code; the UI translates it by code."""

    # Responses always include defaulted fields: mark them required in the OpenAPI.
    model_config = ConfigDict(json_schema_serialization_defaults_required=True)

    code: str
    message: str
    params: dict[str, Any] = Field(default_factory=dict)


class RasterReport(BaseModel):
    crs: str
    width: int
    height: int
    bounds: list[float]
    dtype: str
    nodata: float | None
    values: list[int]
    approxResolutionM: float | None


class IngestionJob(BaseModel):
    """An ingestion job as `GET /admin/jobs/{jobId}` returns it. Fields that jobs
    saved by earlier releases may lack default to null."""

    # Responses always include defaulted fields: mark them required in the OpenAPI.
    model_config = ConfigDict(json_schema_serialization_defaults_required=True)

    jobId: str
    country: str
    layerId: int
    status: Literal["queued", "running", "succeeded", "failed", "cancelled"]
    # While running: "validating", then "converting" (conversion, verification and
    # activation). `progress` is the fraction scanned while validating.
    phase: Literal["validating", "converting"] | None = None
    progress: float | None = None
    createdAt: str
    updatedAt: str
    requestedNodata: float | None = None
    error: JobIssue | None = None
    warnings: list[JobIssue] = Field(default_factory=list)
    report: RasterReport | None = None
    rasterFilename: str | None = None
    version: int | None = None


class JobAccepted(BaseModel):
    jobId: str


class JobCancelled(BaseModel):
    jobId: str
    cancelled: Literal[True]
