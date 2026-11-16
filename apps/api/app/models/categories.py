"""Layer categories as the public API returns them (`GET /categories`).

A category groups a country's layers and says how a layer's `value` (the fraction of
the farm inside the layer's 1-pixels) reads: its polarity, its threshold and the
wording of its results. The API never applies them; the web does, in one place.
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

# Semantic names, not tied to an icon library: the web maps each one to an icon.
# Adding a value is backward compatible; removing one is not.
CategoryIcon = Literal[
    "forest", "shield", "agriculture", "water", "mountain", "wetland", "fire", "layers"
]
CategoryPolarity = Literal["avoid", "required"]


class LocalizedText(BaseModel):
    es: str
    en: str


class ResultLabels(BaseModel):
    ok: LocalizedText = Field(description="Result without findings")
    flagged: LocalizedText = Field(description="Result with findings")


class LayerCategory(BaseModel):
    # Responses always include defaulted fields: mark them required in the OpenAPI.
    model_config = ConfigDict(json_schema_serialization_defaults_required=True)

    id: str = Field(description="Stable slug, unique in its country, never reused")
    name: LocalizedText
    description: LocalizedText
    icon: CategoryIcon
    color: str = Field(description="Hex color, #rrggbb")
    polarity: CategoryPolarity = Field(
        description=(
            "`avoid`: the finding is `value` (coinciding with the layer is a finding). "
            "`required`: the finding is `1 - value` (not coinciding is a finding)."
        )
    )
    thresholdPercentage: float = Field(
        description=(
            "A farm has findings when 100 × finding > thresholdPercentage. Already "
            "resolved: the category's own threshold, or the global one."
        )
    )
    resultLabels: ResultLabels
    temporal: bool = Field(
        description="Whether its layers have a baseline and a comparison year"
    )
