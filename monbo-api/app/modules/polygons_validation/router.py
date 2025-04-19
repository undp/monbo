from app.config.env import OVERLAP_THRESHOLD_PERCENTAGE
from app.models.farms import FarmData, FarmPolygon, UnprocessedFarmData
from app.utils.farms import parse_base_information
from app.utils.polygons import get_polygon_area
from fastapi import APIRouter

from .helpers import (
    check_polygons_overlap,
    ensure_farm_ids,
    get_polygon_coordinates,
)
from .models import GetOverlappingPolygonsResponse

router = APIRouter()


@router.post("/parse-farms", response_model=list[FarmData])
def parse_farms(body: list[UnprocessedFarmData]) -> list[FarmData]:
    """
    Endpoint to parse farm data and generate polygon information.

    Args:
        body (list[UnprocessedFarmData]): List of unprocessed farm data.

    Returns:
        list[FarmData]: List of processed farm data with polygon information.

    Raises:
        HTTPException: If there is an error in parsing farm coordinates or
        generating polygons.

    The endpoint performs the following steps:
    1. Parses the farm coordinates data for each farm in the input list.
    2. Generates polygon information based on the parsed coordinates.
    3. Constructs and returns a list of processed farm data with polygon details.
    4. Auto-generates IDs if needed:
       - If all farms are missing IDs, sequential numbers are assigned
       - If some farms have IDs, IDs matching the existing pattern are generated for
       those missing IDs
       - If all farms have IDs, no changes are made

    Each farm data includes:
    - Basic information such as id, producer, crop type, production details, etc.
    - Polygon type (either "polygon" or "circle").
    - Polygon details including center coordinates, points, radius (if applicable),
    and area.
    """
    # Process farms
    farm_data = []
    for farm in body:
        base_information = parse_base_information(farm)
        farm_data.append(base_information)

    # Ensure all farms have appropriate IDs
    farm_data = ensure_farm_ids(farm_data, body)

    return farm_data


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

    parsed_polygons = list(
        map(
            lambda x: {
                **x.model_dump(),
                "polygon": x.get_polygon(),
            },
            body,
        )
    )

    results = list(map(lambda x: {"farmId": x.id, "status": "VALID"}, body))
    overlaps = check_polygons_overlap(
        list(map(lambda x: x["polygon"], parsed_polygons))
    )

    inconsistentPolygons = []
    for overlap in overlaps:
        overlap_area = get_polygon_area(overlap["intersection_polygon"])
        overlap_polygons_ids = [
            parsed_polygons[overlap["polygon1_idx"]]["id"],
            parsed_polygons[overlap["polygon2_idx"]]["id"],
        ]

        overlap_polygons = list(
            filter(lambda x: x["id"] in overlap_polygons_ids, parsed_polygons)
        )
        overlap_polygons_area = sum(
            list(map(lambda x: get_polygon_area(x["polygon"]), overlap_polygons))
        )

        # Calculate the union area (total area minus the double-counted overlap)
        union_area = overlap_polygons_area - overlap_area

        # Handle the case where polygons are identical or nearly identical
        # Using a small epsilon for floating point comparison
        if abs(overlap_area - union_area) < 1e-10:
            overlap_percentage = 1.0  # 100% overlap
        else:
            overlap_percentage = min(1.0, overlap_area / union_area)  # Cap at 100%

        if overlap_percentage > OVERLAP_THRESHOLD_PERCENTAGE:
            results[overlap["polygon1_idx"]]["status"] = "NOT_VALID"
            results[overlap["polygon2_idx"]]["status"] = "NOT_VALID"

            inconsistentPolygons.append(
                {
                    "type": "overlap",
                    "farmIds": [
                        parsed_polygons[overlap["polygon1_idx"]]["id"],
                        parsed_polygons[overlap["polygon2_idx"]]["id"],
                    ],
                    "data": {
                        "percentage": overlap_percentage,
                        "criticality": "HIGH" if overlap_percentage > 0.8 else "MEDIUM",
                        "area": overlap_area,
                        "center": {
                            "lng": overlap["intersection_polygon"].centroid.x,
                            "lat": overlap["intersection_polygon"].centroid.y,
                        },
                        "path": get_polygon_coordinates(
                            overlap["intersection_polygon"]
                        ),
                    },
                }
            )

    return {
        "farmResults": results,
        "inconsistencies": inconsistentPolygons,
    }
