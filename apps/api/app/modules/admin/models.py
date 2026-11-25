"""Admin contracts: layers and ingestion jobs. The frontend's types are generated from
the API's OpenAPI (`pnpm contracts`), so these models are the single source.

Field names follow the layers index (`<country>/index.json` under MAPS_ROOT), which
is what these endpoints read and write. A layer belongs to the country of the admin
session that created it, so there is no countries field.
"""

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

YEAR = Field(ge=1900, le=2100)
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

    pixel_size: float = Field(gt=0, le=10_000, description="Pixel size in meters")
    baseline: int = YEAR
    compared_against: int = YEAR
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
    def _baseline_not_after_comparison(self) -> "LayerInput":
        if self.baseline > self.compared_against:
            raise ValueError("baseline must not be later than compared_against")
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
    pixel_size: float
    baseline: int | None
    compared_against: int | None
    references: list[str]
    enabled: bool
    version: int
    raster_filename: str | None
    has_raster: bool
    attributes: dict[str, StoredAttributes | None]
    considerations: dict[str, str | None]


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
