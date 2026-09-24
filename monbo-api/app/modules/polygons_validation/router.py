from fastapi import APIRouter, HTTPException

from app.models.farms import (
    FarmPolygonDetailData,
    FarmPolygonDetailDataWithPolygon,
)
from app.utils.farms import get_farm_coords_and_radius
from app.utils.polygons import generate_polygon

from .helpers import (
    get_geometry_inconsistencies,
    get_overlap_inconsistencies,
)
from .models import PolygonInconsistenciesResponse

router = APIRouter()


@router.post(
    "/validate",
    response_model=PolygonInconsistenciesResponse,
    name="Validate Polygons",
)
def get_polygon_inconsistencies(
    body: list[FarmPolygonDetailData],
) -> PolygonInconsistenciesResponse:
    """
    Validates a list of farm polygons by checking for overlaps and geometry
    inconsistencies.

    Args:
        body (list[FarmPolygon]): List of farm polygons to validate.

    Returns:
        PolygonInconsistenciesResponse: A response object containing:
            - farmResults (list[FarmResult]): A list of validation results
              for each farm, with status either "VALID" or "NOT_VALID"
            - inconsistencies (list[PolygonInconsistency]): A list of detected
              inconsistencies, which can be overlaps or geometry issues

    The function performs the following validations:
    1. Converts the input FarmPolygons into Shapely geometry objects
    2. Checks for overlapping polygons between farms
    3. Validates the geometry of each polygon (e.g. self-intersections)
    4. Marks farms as "NOT_VALID" if they are involved in any inconsistency
    """
    farms_polygons = []
    for farm in body:
        try:
            coords, radius = get_farm_coords_and_radius(farm)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        polygon = generate_polygon(coords, radius)

        # Create farm polygon object with all details
        farms_polygons.append(
            FarmPolygonDetailDataWithPolygon(
                id=farm.id,
                type=farm.type,
                details=farm.details,
                polygon=polygon,
            )
        )

    # Initialize results with VALID status
    results = list(map(lambda x: {"farmId": x.id, "status": "VALID"}, body))

    # Create a lookup dictionary for results for O(1) access
    results_lookup = {result["farmId"]: result for result in results}

    # Get inconsistencies
    overlap_inconsistencies = get_overlap_inconsistencies(farms_polygons)
    geometry_inconsistencies = get_geometry_inconsistencies(farms_polygons)

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

    return PolygonInconsistenciesResponse.model_validate(
        {
            "farmResults": results,
            "inconsistencies": all_inconsistencies,
        }
    )
