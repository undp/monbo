from typing import Annotated, Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field
from shapely.geometry import MultiPolygon, Point, Polygon

from .polygons import PointDetails, PolygonDetails


class PointSummary(BaseModel):
    """A farm given as a point: always a center, a radius and the area they cover."""

    type: Literal["point"]
    details: PointDetails
    area: float


class PolygonShapeSummary(BaseModel):
    """A farm given as a polygon; details and area are null when the geometry is
    empty."""

    type: Literal["polygon"]
    details: PolygonDetails | None
    area: float | None


# A farm's geometry, discriminated by `type` so clients get the exact shape of each
# kind (the generated frontend types rely on it).
PolygonSummary = Annotated[
    PointSummary | PolygonShapeSummary, Field(discriminator="type")
]


class Document(BaseModel):
    name: str
    url: str


class FarmData(BaseModel):
    # Responses always include defaulted fields: mark them required in the OpenAPI.
    model_config = ConfigDict(json_schema_serialization_defaults_required=True)

    id: str
    producer: str
    producerId: str
    cropType: str
    productionDate: str
    production: float
    productionQuantityUnit: str
    country: str
    region: Optional[str] = None
    association: Optional[str] = None
    documents: list[Document]
    polygon: PolygonSummary


class InputFarmData(BaseModel):
    id: Optional[str | int] = None
    producerName: str
    productionDate: str
    productionQuantity: int | float | str
    productionQuantityUnit: str
    country: str
    region: Optional[str] = None
    coordinatesFormat: Literal["WKT", "GeoJSON"]
    # "Polygon" and "MultiPolygon" are interchangeable: the coordinates tell which
    geometryType: Literal["Point", "Polygon", "MultiPolygon"]
    farmCoordinates: str
    cropType: str
    association: Optional[str] = None
    area: Optional[int | float | str] = None
    documents: list[Document]


class PreProcessedFarmData(BaseModel):
    id: str
    producerName: str
    productionDate: str
    productionQuantity: float
    productionQuantityUnit: str
    country: str
    region: Optional[str] = None
    coordinatesFormat: Literal["WKT", "GeoJSON"]
    geometryType: Literal["Point", "Polygon", "MultiPolygon"]
    # The parsed coordinates: a point, or a polygon or multipolygon with its holes
    farmCoordinates: Point | Polygon | MultiPolygon
    cropType: str
    association: Optional[str] = None
    area: float
    documents: list[Document]

    model_config = {"arbitrary_types_allowed": True}


class FarmPolygonDetailData(BaseModel):
    id: str
    type: Literal["polygon", "point"]
    details: PolygonDetails | PointDetails | None


class FarmPolygonDetailDataWithPolygon(FarmPolygonDetailData):
    polygon: Polygon | MultiPolygon

    model_config = {"arbitrary_types_allowed": True}


class ImportIssue(BaseModel):
    """A problem with an imported geo file or one of its features. The web
    translates it by `code` (with `params`); `message` is the English fallback."""

    # Responses always include defaulted fields: mark them required in the OpenAPI.
    model_config = ConfigDict(json_schema_serialization_defaults_required=True)

    code: str
    message: str
    params: dict[str, Any] = Field(default_factory=dict)


class ImportedFeature(BaseModel):
    """One feature of an imported geo file, with its geometry as WKT so it can be
    sent unchanged to `/farms/parse`. Geometry fields are null when the feature has
    errors."""

    # Responses always include defaulted fields: mark them required in the OpenAPI.
    model_config = ConfigDict(json_schema_serialization_defaults_required=True)

    position: int = Field(description="1-based position of the feature in the file")
    properties: dict[str, str | int | float | bool | None]
    geometryType: Literal["Point", "Polygon", "MultiPolygon"] | None = None
    farmCoordinates: str | None = Field(
        default=None, description="The geometry as WKT, in EPSG:4326"
    )
    errors: list[ImportIssue] = Field(default_factory=list)


class ImportedFile(BaseModel):
    """An imported geo file: its format and its features, in file order."""

    format: Literal["geojson", "kml", "kmz", "shapefile"] = Field(
        description="In a KML or KMZ, a placemark's name is the farm's ID when it has "
        "no ID attribute"
    )
    features: list[ImportedFeature]
