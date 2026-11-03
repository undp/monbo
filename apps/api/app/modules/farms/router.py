from fastapi import APIRouter, File, HTTPException, Query, UploadFile
from pydantic import BaseModel

from app.models.farms import FarmData, ImportedFile, ImportIssue, InputFarmData

from . import geo_import
from .helpers import generate_farms
from .validations import parse_farms_validation, validate_locale

router = APIRouter()


@router.post("/parse", response_model=list[FarmData])
def parse_farms(
    body: list[InputFarmData],
    locale: str = Query(
        "en", description="Locale for number parsing, e.g., 'en' or 'es'"
    ),
) -> list[FarmData]:
    """
    Endpoint to parse farm data and generate polygon information.

    Args:
        body (list[InputFarmData]): List of unprocessed farm data
        locale (str): Locale for number parsing, either 'en' or 'es'. Defaults to 'en'

    Returns:
        list[FarmData]: List of processed farm data with polygon information

    Raises:
        HTTPException: If there is an error in:
            - Parsing farm coordinates
            - Generating polygons
            - Invalid locale format
            - Invalid number formats for the given locale
            - Invalid country codes
            - Invalid document URLs
            - Duplicate farm IDs (if IDs are provided)

    The endpoint performs the following steps:
    1. Validates the locale and farm data inputs
    2. Parses and validates all numeric values according to the locale
    3. Validates country codes, coordinates format, and document URLs
    4. Generates polygon information based on the parsed coordinates
    5. Auto-generates IDs if needed:
       - If all farms are missing IDs, sequential numbers are assigned
       - If some farms have IDs, IDs matching the existing pattern are generated for
       those missing IDs
       - If all farms have IDs, no changes are made

    Each farm data includes:
    - Basic information such as id, producer, crop type, production details, etc.
    - Polygon type (either "polygon" or "point")
    - Polygon details including coordinates, area and other geometric properties
    """
    # Validate locale
    validate_locale(locale)

    # Validate farms
    preprocessed_farms = parse_farms_validation(body, locale)

    # Process farms
    farm_data = generate_farms(preprocessed_farms)

    return farm_data


class ImportErrorResponse(BaseModel):
    """Body of a rejected import: the problem with the whole file."""

    detail: ImportIssue


@router.post(
    "/import",
    response_model=ImportedFile,
    responses={
        400: {"model": ImportErrorResponse},
        413: {"model": ImportErrorResponse},
    },
)
def import_farms(file: UploadFile = File(...)) -> ImportedFile:
    """
    Reads the farms of a geo file: GeoJSON (`.geojson`, `.json`), KML, KMZ or a
    zipped Shapefile (`.zip`, every `.shp` inside is read, so points and polygons can
    come as two Shapefiles).

    The answer has the file's `format` and its features. Each feature comes back with
    its 1-based position, its attributes (JSON values; dates as ISO strings) and its
    geometry as WKT in EPSG:4326 (`geometryType`, `farmCoordinates`), ready for
    `POST /farms/parse` with `coordinatesFormat: "WKT"`. Polygons keep their holes, and
    a MultiPolygon of several parts is one farm (one of one part is that Polygon). A
    feature that is no polygon or point comes back with `errors` instead of a
    geometry. In a KML or KMZ, `id` is the placemark's ID attribute (from its
    ExtendedData), never its XML `id`.

    A problem with the whole file (unsupported type, unreadable, larger than
    the limit, a Shapefile without `.prj`, no features...) is a 400 (413 when too
    large) whose `detail` has a stable `code`, `params` and an English `message`.
    """
    # Sync on purpose: GDAL blocks, so FastAPI runs this in its threadpool.
    content = file.file.read(geo_import.MAX_UPLOAD_BYTES + 1)
    try:
        if len(content) > geo_import.MAX_UPLOAD_BYTES:
            raise geo_import.file_too_large()
        return geo_import.import_geo_file(file.filename or "", content)
    except geo_import.GeoImportError as exc:
        raise HTTPException(
            status_code=exc.status_code, detail=exc.as_issue().model_dump()
        ) from exc
