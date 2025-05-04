from collections import Counter
from fastapi import HTTPException
from app.models.farms import (
    InputFarmData,
    PreProcessedFarmData,
    Document,
    Coordinates,
)
from app.utils.url import is_valid_url
from app.utils.numbers import parse_float_string
from app.utils.farms import parse_farm_coordinates_string
import pycountry
import random
import string


MAX_RANDOM_ID_BATCH = 10_000


"""
TODO's
    - report errors referencing the object that failed
    - batch error reporting
    - unit tests
"""


def validate_locale(locale: str) -> None:
    """
    Validates that a locale follows the ISO 639-1 standard.
    """
    if locale not in ["en", "es"]:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid locale: {locale}. Must be 'en' or 'es'.",
        )


def validate_unique_ids(body: list[InputFarmData]) -> None:
    """
    Validates that all farm IDs in the input list are unique.
    Raises HTTPException if duplicate IDs are found.
    """
    # Collect all non-None IDs
    ids = [farm.id for farm in body if farm.id is not None]
    # Count occurrences
    id_counts = Counter(ids)
    # Find duplicates
    duplicates = [id_ for id_, count in id_counts.items() if count > 1]
    if duplicates:
        raise HTTPException(
            status_code=400,
            detail=f"Duplicate farm IDs found: {duplicates}",
        )


def ensure_farm_ids(farms_data: list[InputFarmData]) -> None:
    """
    Ensures all farms have appropriate IDs based on existing data patterns.

    Args:
        farms_data (list[InputFarmData]): List of farm data objects to process

    Note:
        This function modifies the input list in-place by assigning IDs to farms that
        don't have them.

    Details:
        - If all farms have IDs: do nothing
        - If no farms have IDs: assigns sequential numeric IDs (1, 2, 3, etc)
        - If some farms have IDs: generates random unique 6-character alphanumeric IDs
          for those missing IDs
    """
    # Check if any farms have IDs
    farms_with_id = [farm for farm in farms_data if bool(farm.id)]
    all_have_ids = len(farms_with_id) == len(farms_data)
    none_have_ids = len(farms_with_id) == 0

    if all_have_ids:
        # All farms have IDs, no action needed
        return farms_data

    # IMPORTANT!
    # Due to the random 6-alphanumeric chars ID generation method, the theoretical
    # maximum number of possible IDs is 2,176,782,336. In practice, generating
    # many less IDs could cause performance degradation. So the limit of records
    # this code can handle will be set to 10,000.
    if len(farms_data) - len(farms_with_id) > MAX_RANDOM_ID_BATCH:
        raise HTTPException(
            status_code=400,
            detail=(
                "The maximum number of farms for generating random IDs is 10,000. "
                "Please reduce the number of farms or process the data in batches."
            ),
        )

    # Generate a set of existing IDs to avoid duplicates
    existing_ids = {str(farm.id) for farm in farms_with_id}

    # Assign IDs to farms that need them
    for i, farm_data in enumerate(farms_data):
        if none_have_ids:
            # If none have IDs, assign sequential numbers
            farm_data.id = str(i + 1)
        elif not bool(farm_data.id):
            # If some have IDs but this one doesn't
            # Generate a short alphanumeric ID (6 characters)
            while True:
                short_id = "".join(
                    random.choices(string.ascii_uppercase + string.digits, k=6)
                )
                if short_id not in existing_ids:
                    break
            farm_data.id = short_id
            existing_ids.add(short_id)


def validate_production_date(production_date: str) -> str:
    """
    Validates production date string.
    Currently a placeholder as the string is only shown to users.
    """
    # Not needed for now. The string is not used by the backend, just shown to the user
    return production_date


def validate_production_quantity(production_quantity: str, locale: str) -> float:
    """
    Validates and parses production quantity string based on locale.
    Returns float value or raises HTTPException if invalid.
    """
    try:
        return parse_float_string(production_quantity, locale)
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=f"Production quantity must be a valid number: {e}",
        )


def validate_country_code(country_code: str) -> str:
    """
    Validates that a country code follows the ISO 3166-1 alpha-2 standard.

    Args:
        country_code: A string representing a country code to validate

    Returns:
        str: The validated country code if valid

    Raises:
        HTTPException: If the country code is not exactly 2 characters or
                      does not match a valid ISO 3166-1 alpha-2 code
    """
    country = pycountry.countries.get(alpha_2=country_code)
    if not country:
        raise HTTPException(
            status_code=400,
            detail=f"'{country_code}' is not a valid ISO 3166-1 alpha-2 country code",
        )

    return country_code


def validate_farm_coordinates(coordinates: str) -> list[Coordinates]:
    """
    Validates and parses farm coordinates string.
    Returns parsed coordinates or raises HTTPException if invalid.
    """
    try:
        return parse_farm_coordinates_string(coordinates)
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid farm coordinates: {e}",
        )


def validate_area(area: str, locale: str) -> float:
    """
    Validates and parses area string based on locale.
    Returns float value or raises HTTPException if invalid.
    """
    try:
        return parse_float_string(area, locale)
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=f"Area must be a valid number: {e}",
        )


def validate_documents(documents: list[Document]) -> list[Document]:
    """
    Validates list of document URLs.
    Raises HTTPException if any URL is invalid.
    """
    for document in documents:
        if not is_valid_url(document.url):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid document URL: {document.url}",
            )
    return documents


def parse_farms_validation(
    body: list[InputFarmData],
    locale: str,
) -> list[PreProcessedFarmData]:
    """
    Validates and preprocesses a list of farm data inputs.

    Args:
        body (list[InputFarmData]): List of raw farm data to validate
        locale (str): Locale string for number parsing (e.g. 'en', 'es')

    Returns:
        list[PreProcessedFarmData]: List of validated and preprocessed farm data

    Raises:
        HTTPException: If validation fails for any of the following:
            - Duplicate farm IDs (if IDs are provided)
            - Invalid production quantity number format for the given locale
            - Invalid country code (must be ISO 3166-1 alpha-2)
            - Invalid farm coordinates format
            - Invalid area number format for the given locale
            - Invalid document URLs
    """
    validate_unique_ids(body)

    # Ensure all farms have appropriate IDs
    ensure_farm_ids(body)

    return [
        PreProcessedFarmData(
            id=str(farm.id),
            producerName=farm.producerName,
            productionDate=validate_production_date(farm.productionDate),
            productionQuantity=validate_production_quantity(
                farm.productionQuantity, locale
            ),
            productionQuantityUnit=farm.productionQuantityUnit,
            country=validate_country_code(farm.country),
            region=farm.region,
            farmCoordinates=validate_farm_coordinates(farm.farmCoordinates),
            cropType=farm.cropType,
            association=farm.association,
            area=validate_area(farm.area, locale),
            documents=validate_documents(farm.documents),
        )
        for farm in body
    ]
