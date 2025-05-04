from fastapi import APIRouter, Query
from app.models.farms import FarmData, InputFarmData
from app.utils.farms import parse_base_information
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
    farm_data = [parse_base_information(farm) for farm in preprocessed_farms]

    return farm_data
