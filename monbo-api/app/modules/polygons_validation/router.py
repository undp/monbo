from app.models.farms import FarmPolygon, FarmWithPolygon
from fastapi import APIRouter
from .helpers import (
    get_geometry_inconsistencies,
    get_overlap_inconsistencies,
)
from .models import GetOverlappingPolygonsResponse


router = APIRouter()


@router.post(
    "/validate",
    response_model=GetOverlappingPolygonsResponse,
    name="Validate Polygons",
)
def get_overlapping_polygons(
    body: list[FarmPolygon],
) -> GetOverlappingPolygonsResponse:
    """
    Processes a list of farm polygons to identify and handle overlapping polygons.

    Args:
        body (list[FarmPolygon]): List of farm polygons and their associated data.

    Returns:
        GetOverlappingPolygonsResponse: A response object containing:
            - farmResults (list[dict]): A list of dictionaries with polygon IDs
            and their validation status.
            - inconsistencies (list[dict]): A list of dictionaries detailing the
            overlapping polygons and their overlap information.

    The function performs the following steps:
    1. Parses the farm coordinates data for each farm polygon.
    2. Generates polygon objects and calculates their details (center, points, radius).
    3. Identifies and handles any exceptions during polygon generation.
    4. Filters out valid polygons that do not have any issues.
    5. Checks for overlaps among the valid polygons.
    6. Collects the indices of polygons with overlap issues.
    7. Constructs a list of inconsistent polygons with overlap details, including
    the area, center, and path of the overlap.
    """

    parsed_farms: list[FarmWithPolygon] = list(
        map(
            lambda x: {
                **x.model_dump(),
                "polygon": x.get_polygon(),
            },
            body,
        )
    )

    # Initialize results with VALID status
    results = list(map(lambda x: {"farmId": x.id, "status": "VALID"}, body))

    # Create a lookup dictionary for results for O(1) access
    results_lookup = {result["farmId"]: result for result in results}

    # Get inconsistencies
    overlap_inconsistencies = get_overlap_inconsistencies(parsed_farms)
    geometry_inconsistencies = get_geometry_inconsistencies(parsed_farms)

    all_inconsistencies = overlap_inconsistencies + geometry_inconsistencies

    # Create a set of farm IDs involved in inconsistencies for O(1) lookup
    invalid_farm_ids = {
        farm_id
        for inconsistency in all_inconsistencies
        for farm_id in inconsistency["farmIds"]
    }

    # Update status for invalid farms
    for farm_id in invalid_farm_ids:
        results_lookup[farm_id]["status"] = "NOT_VALID"

    return {
        "farmResults": results,
        "inconsistencies": all_inconsistencies,
    }
