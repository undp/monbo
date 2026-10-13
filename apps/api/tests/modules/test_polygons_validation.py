import json
import math

import pytest
from fastapi.testclient import TestClient
from shapely.geometry import GeometryCollection, LineString, MultiPolygon, Polygon
from shapely.geometry import Point as SPoint

from app.helpers.GeometryCalculator import GeometryCalculator
from app.main import app
from app.models.polygons import Coordinates
from app.modules.polygons_validation.helpers import (
    detect_overlaps,
    get_geometry_paths,
    get_overlap_criticality,
    get_overlap_ratio,
    is_overlap_above_threshold,
    polygonal_part,
)
from app.modules.polygons_validation.models import PolygonInconsistenciesResponse
from app.utils.farms import parse_farm_coordinates_string
from app.utils.image_generation.GeoHelper import GeoHelper
from app.utils.polygons import (
    determine_polygon_type,
    generate_polygon,
)


def test_generate_polygon():
    """
    Test the generate_polygon function with different sets of coordinates.
    This test covers two scenarios:
    1. When the input coordinates form a polygon (multiple coordinates).
    2. When the input coordinates form a single point (a single coordinate plus a
       radius, which is buffered into a circular polygon).

    generate_polygon returns a Shapely Polygon; determine_polygon_type reports
    whether the coordinates represent a "polygon" or a "point".
    Coordinates expose longitude/latitude via `.lng` / `.lat`.
    """
    points = [
        Coordinates(lng=0, lat=0),
        Coordinates(lng=0, lat=1),
        Coordinates(lng=1, lat=1),
        Coordinates(lng=1, lat=0),
    ]

    expected_polygon = Polygon([(point.lng, point.lat) for point in points])
    assert determine_polygon_type(points) == "polygon"
    polygon = generate_polygon(points, None)
    assert expected_polygon.equals(polygon)

    single_point = [Coordinates(lng=0, lat=0)]
    radius_m = 99
    assert determine_polygon_type(single_point) == "point"
    polygon = generate_polygon(single_point, radius_m)
    # A point with a radius is buffered into a non-empty circular polygon
    # centered on the coordinate.
    assert polygon.geom_type == "Polygon"
    assert not polygon.is_empty
    assert polygon.contains(SPoint(0, 0))

    # Derive the expected buffer radius (in degrees) the same way the app does,
    # so these geometry assertions track the real implementation instead of a
    # hard-coded magic number.
    radius_degrees, _ = GeoHelper.meters_to_degrees(radius_m, single_point[0].lat)
    center = SPoint(0, 0)

    # (i) The buffered polygon's area matches the target circle. Shapely
    # approximates the circle with straight segments, so the polygon is slightly
    # smaller than the true disk; allow a small relative tolerance for that
    # discretization rather than pinning an exact value.
    expected_circle_area = math.pi * radius_degrees**2
    assert math.isclose(polygon.area, expected_circle_area, rel_tol=0.05)

    # (ii) The polygon is bounded between two concentric disks just inside and
    # just outside the nominal radius: contained in a slightly larger disk and
    # containing a slightly smaller one. This pins both the radius and the
    # centering while staying robust to the buffer's segment count.
    assert center.buffer(radius_degrees * 1.01).contains(polygon)
    assert polygon.contains(center.buffer(radius_degrees * 0.97))


def test_check_ploygons_overlap():
    """
    Test the check_polygons_overlap function to ensure it correctly identifies
     overlapping polygons.
    This test creates three polygons:
    - polygon1: A square from (0, 0) to (1, 1)
    - polygon2: A square from (1, 0) to (2, 1), which overlaps with polygon1 at the edge
    - polygon3: A square from (2, 0) to (3, 1), which does not overlap with polygon1
    The test asserts that:
    - The check_polygons_overlap function returns 1 overlapping polygon when given
    polygon1 and polygon2.
    - The check_polygons_overlap function returns 0 overlapping polygons when given
    polygon1 and polygon3.
    """
    polygon1 = Polygon([(0, 0), (0, 1), (1, 1), (1, 0)])
    polygon2 = Polygon([(1, 0), (1, 1), (2, 1), (2, 0)])
    polygon3 = Polygon([(2, 0), (2, 1), (3, 1), (3, 0)])

    # Touching pairs are candidates here; get_overlap_inconsistencies drops them
    # because their intersection has no area.
    assert len(detect_overlaps([polygon1, polygon2])) == 1
    assert len(detect_overlaps([polygon1, polygon3])) == 0


def test_get_polygon_area():
    """
    Test the get_polygon_area function to ensure it correctly calculates the area
    of a given polygon.
    This test uses two predefined polygons (polygon_1 and polygon_2) and compares
    the calculated areas with known values.
    The test passes if the relative error between the calculated area and the known
    value is less than 1%.

    Test cases:
    1. polygon_1:
       - Coordinates: [(-79.131151, -4.676182), (-79.131946, -4.675285),
       (-79.131947, -4.675288), (-79.132001, -4.67538), (-79.132162, -4.67565),
       (-79.132341, -4.675759), (-79.132487, -4.676019), (-79.132547, -4.676126),
       (-79.132376, -4.676365), (-79.132138, -4.676403), (-79.132088, -4.67631),
       (-79.131598, -4.676389), (-79.131151, -4.676182)]
       - Known area (gee_poly1_area): 10369.361754695708
    2. polygon_2:
       - Coordinates: [(-79.134616, -4.680456), (-79.134634, -4.680454),
       (-79.134911, -4.680381), (-79.135198, -4.680183), (-79.135211, -4.680174),
       (-79.135311, -4.680152), (-79.135623, -4.680084), (-79.135629, -4.680065),
       (-79.135748, -4.679641), (-79.136017, -4.67945), (-79.136317, -4.680072),
       (-79.136587, -4.680576), (-79.136953, -4.681637), (-79.136897, -4.68166),
       (-79.136811, -4.68181), (-79.136367, -4.681857), (-79.13626, -4.681818),
       (-79.135698, -4.681882), (-79.135392, -4.682708), (-79.133598, -4.681653),
       (-79.133398, -4.679579), (-79.133592, -4.679552), (-79.133751, -4.679798),
       (-79.133753, -4.68015), (-79.13397, -4.680404), (-79.133982, -4.680417),
       (-79.134248, -4.680488), (-79.134287, -4.680498), (-79.134616, -4.680456)]
       - Known area (gee_poly2_area): 77167.23433934484

    Asserts:
    - The relative error between the calculated area and the known area is less than 1%.
    """
    polygon_1 = Polygon(
        [
            (-79.131151, -4.676182),
            (-79.131946, -4.675285),
            (-79.131947, -4.675288),
            (-79.132001, -4.67538),
            (-79.132162, -4.67565),
            (-79.132341, -4.675759),
            (-79.132487, -4.676019),
            (-79.132547, -4.676126),
            (-79.132376, -4.676365),
            (-79.132138, -4.676403),
            (-79.132088, -4.67631),
            (-79.131598, -4.676389),
            (-79.131151, -4.676182),
        ]
    )
    gee_poly1_area = 10369.361754695708
    poly1_area = GeometryCalculator.calculate_polygon_area(polygon_1)
    assert abs(poly1_area - gee_poly1_area) / gee_poly1_area < 0.01

    polygon_2 = Polygon(
        [
            (-79.134616, -4.680456),
            (-79.134634, -4.680454),
            (-79.134911, -4.680381),
            (-79.135198, -4.680183),
            (-79.135211, -4.680174),
            (-79.135311, -4.680152),
            (-79.135623, -4.680084),
            (-79.135629, -4.680065),
            (-79.135748, -4.679641),
            (-79.136017, -4.67945),
            (-79.136317, -4.680072),
            (-79.136587, -4.680576),
            (-79.136953, -4.681637),
            (-79.136897, -4.68166),
            (-79.136811, -4.68181),
            (-79.136367, -4.681857),
            (-79.13626, -4.681818),
            (-79.135698, -4.681882),
            (-79.135392, -4.682708),
            (-79.133598, -4.681653),
            (-79.133398, -4.679579),
            (-79.133592, -4.679552),
            (-79.133751, -4.679798),
            (-79.133753, -4.68015),
            (-79.13397, -4.680404),
            (-79.133982, -4.680417),
            (-79.134248, -4.680488),
            (-79.134287, -4.680498),
            (-79.134616, -4.680456),
        ]
    )
    gee_poly2_area = 77167.23433934484
    poly2_area = GeometryCalculator.calculate_polygon_area(polygon_2)
    assert abs(poly2_area - gee_poly2_area) / gee_poly2_area < 0.01


def test_parse_farm_coordinates_data():
    """
    Test the parse_farm_coordinates_data function.
    This test checks if the parse_farm_coordinates_data function correctly
    parses a WKT polygon string into a list of Coordinates objects.
    The parser returns every vertex of the exterior ring, including the closing
    coordinate that repeats the first vertex.
    Test case:
    - coordinates_format: "WKT"
    - geometry_type: "Polygon"
    - input_coordinates: "POLYGON((0 0, 1 1, 2 2, 0 0))"
    - expected_points: the four ring vertices (closing point included)
    Asserts:
    - The parsed coordinates match the expected list of Coordinates objects.
    """
    coordinates_format = "WKT"
    geometry_type = "Polygon"
    input_coordinates = "POLYGON((0 0, 1 1, 2 2, 0 0))"
    expected_points = [
        Coordinates(lng=0, lat=0),
        Coordinates(lng=1, lat=1),
        Coordinates(lng=2, lat=2),
        Coordinates(lng=0, lat=0),
    ]

    parsed_points = parse_farm_coordinates_string(
        coordinates_format, geometry_type, input_coordinates
    )
    assert parsed_points == expected_points


def test_get_polygon_coordinates():
    """
    Test the get_polygon_coordinates function.
    This test creates a polygon with specified coordinates and checks if the
    get_polygon_coordinates function returns the expected list of coordinates
    in the correct format.
    The polygon created has the following coordinates:
    - (0, 0)
    - (0, 1)
    - (1, 1)
    - (1, 0)
    - (0, 0)
    The expected output is a list of dictionaries with 'lat' and 'lng' keys
    representing the latitude and longitude of each point in the polygon.
    The test asserts that the output of get_polygon_coordinates matches the
    expected list of coordinates.
    """
    polygon = Polygon([(0, 0), (0, 1), (1, 1), (1, 0), (0, 0)])
    expected_coordinates = [
        [
            {"lng": 0, "lat": 0},
            {"lng": 0, "lat": 1},
            {"lng": 1, "lat": 1},
            {"lng": 1, "lat": 0},
            {"lng": 0, "lat": 0},
        ]
    ]

    assert get_geometry_paths(polygon) == expected_coordinates


def test_each_inconsistency_kind_serializes_unchanged():
    """The response's inconsistencies are discriminated by `type`; the JSON stays
    what the helpers build."""
    inconsistencies = [
        {
            "type": "overlap",
            "farmIds": ["a", "b"],
            "data": {
                "area": 1.5,
                "center": {"lat": 1.0, "lng": 2.0},
                "paths": [[{"lat": 1.0, "lng": 2.0}]],
                "percentage": 0.9,
                "criticality": "HIGH",
            },
        },
        {
            "type": "invalid_geometry",
            "farmIds": ["c"],
            "data": {"reason": "Self-intersection"},
        },
        {"type": "empty_polygon", "farmIds": ["d"], "data": None},
    ]
    response = PolygonInconsistenciesResponse.model_validate(
        {"farmResults": [], "inconsistencies": inconsistencies}
    )
    assert response.model_dump()["inconsistencies"] == inconsistencies


# --- /validate: overlaps between farms ------------------------------------------

client = TestClient(app)


@pytest.fixture
def overlap_threshold_1(monkeypatch):
    monkeypatch.setattr(
        "app.modules.polygons_validation.helpers.OVERLAP_THRESHOLD_PERCENTAGE", 1.0
    )


def _farm(farm_id, path):
    return {
        "id": farm_id,
        "type": "polygon",
        "details": {
            "center": (
                {"lng": path[0][0], "lat": path[0][1]} if path else {"lng": 0, "lat": 0}
            ),
            "path": [{"lng": lng, "lat": lat} for lng, lat in path],
        },
    }


def _box(west, south, east, north):
    """A rectangle near the equator, in thousandths of a degree (about 111 m)."""
    west, south, east, north = (v / 1000 for v in (west, south, east, north))
    return [(west, south), (east, south), (east, north), (west, north)]


def _validate(*farms):
    response = client.post("/polygons_validation/validate", json=list(farms))
    assert response.status_code == 200, response.text
    body = response.json()
    statuses = {r["farmId"]: r["status"] for r in body["farmResults"]}
    return statuses, body["inconsistencies"]


def _overlaps(inconsistencies):
    return [i for i in inconsistencies if i["type"] == "overlap"]


@pytest.mark.usefixtures("overlap_threshold_1")
@pytest.mark.parametrize(
    ("small", "percentage", "criticality"),
    [
        # Entirely inside a 10x10 farm: 1% of the large farm, 100% of the small one
        pytest.param(_box(4, 4, 5, 5), 1.0, "HIGH", id="contained"),
        # 99% of the small farm lies inside the large one
        pytest.param(_box(9.01, 4, 10.01, 5), 0.99, "HIGH", id="almost contained"),
        pytest.param(_box(0, 0, 10, 10), 1.0, "HIGH", id="identical"),
        # Half of the small farm sticks out
        pytest.param(_box(9.5, 4, 10.5, 5), 0.5, "MEDIUM", id="half inside"),
    ],
)
def test_overlap_is_relative_to_the_smaller_farm(small, percentage, criticality):
    statuses, inconsistencies = _validate(
        _farm("large", _box(0, 0, 10, 10)), _farm("small", small)
    )
    [overlap] = _overlaps(inconsistencies)
    assert sorted(overlap["farmIds"]) == ["large", "small"]
    assert overlap["data"]["percentage"] == pytest.approx(percentage, abs=1e-3)
    assert overlap["data"]["criticality"] == criticality
    assert statuses == {"large": "NOT_VALID", "small": "NOT_VALID"}


@pytest.mark.usefixtures("overlap_threshold_1")
def test_overlap_between_farms_of_equal_size():
    _, inconsistencies = _validate(
        _farm("a", _box(0, 0, 2, 2)), _farm("b", _box(1, 0, 3, 2))
    )
    [overlap] = _overlaps(inconsistencies)
    assert overlap["data"]["percentage"] == pytest.approx(0.5, abs=1e-3)
    assert overlap["data"]["criticality"] == "MEDIUM"


@pytest.mark.usefixtures("overlap_threshold_1")
def test_three_farms_overlapping_each_other():
    statuses, inconsistencies = _validate(
        _farm("a", _box(0, 0, 2, 2)),
        _farm("b", _box(1, 0, 3, 2)),
        _farm("c", _box(1.5, 0, 3.5, 2)),
    )
    pairs = sorted(sorted(o["farmIds"]) for o in _overlaps(inconsistencies))
    assert pairs == [["a", "b"], ["a", "c"], ["b", "c"]]
    assert set(statuses.values()) == {"NOT_VALID"}


@pytest.mark.usefixtures("overlap_threshold_1")
@pytest.mark.parametrize(
    "neighbour",
    [
        pytest.param(_box(1, 0, 2, 1), id="shared edge"),
        pytest.param(_box(1, 1, 2, 2), id="shared vertex"),
    ],
)
def test_farms_that_only_touch_dont_overlap(neighbour):
    statuses, inconsistencies = _validate(
        _farm("a", _box(0, 0, 1, 1)), _farm("b", neighbour)
    )
    assert inconsistencies == []
    assert statuses == {"a": "VALID", "b": "VALID"}


@pytest.mark.usefixtures("overlap_threshold_1")
def test_overlap_that_also_shares_an_edge():
    # B is an L: its top overlaps A's bottom-right corner (0.5 x 0.5), and its
    # notch runs along A's bottom edge, so the intersection is a GeometryCollection
    # of that square and a line.
    a = _box(0, 0, 3, 1)
    b = [
        (x / 1000, y / 1000)
        for x, y in [(1.2, -1), (2, -1), (2, 0.5), (1.5, 0.5), (1.5, 0), (1.2, 0)]
    ]
    _, inconsistencies = _validate(_farm("a", a), _farm("b", b))
    [overlap] = _overlaps(inconsistencies)
    # B covers 1.05 units; 0.25 of them overlap A
    assert overlap["data"]["percentage"] == pytest.approx(0.25 / 1.05, abs=1e-3)
    [path] = overlap["data"]["paths"]
    lngs = {round(p["lng"] * 1000, 6) for p in path}
    lats = {round(p["lat"] * 1000, 6) for p in path}
    assert lngs == {1.5, 2.0}
    assert lats == {0.0, 0.5}


@pytest.mark.usefixtures("overlap_threshold_1")
def test_tiny_farms_that_only_touch():
    # Areas this small round to 0 m²
    a = [(0, 0), (1e-8, 0), (1e-8, 1e-8), (0, 1e-8)]
    b = [(1e-8, 0), (2e-8, 0), (2e-8, 1e-8), (1e-8, 1e-8)]
    _, inconsistencies = _validate(_farm("a", a), _farm("b", b))
    assert _overlaps(inconsistencies) == []


# --- Overlap helpers ------------------------------------------------------------

SQUARE = Polygon([(0, 0), (1, 0), (1, 1), (0, 1)])
OTHER_SQUARE = Polygon([(2, 0), (3, 0), (3, 1), (2, 1)])


@pytest.mark.parametrize(
    ("geometry", "expected"),
    [
        pytest.param(SQUARE, SQUARE, id="polygon"),
        pytest.param(
            MultiPolygon([SQUARE, OTHER_SQUARE]),
            MultiPolygon([SQUARE, OTHER_SQUARE]),
            id="multipolygon",
        ),
        pytest.param(
            GeometryCollection([SQUARE, LineString([(1, 0), (2, 0)])]),
            SQUARE,
            id="polygon and line",
        ),
        pytest.param(
            GeometryCollection([SQUARE, OTHER_SQUARE, SPoint(5, 5)]),
            MultiPolygon([SQUARE, OTHER_SQUARE]),
            id="polygons and point",
        ),
        pytest.param(LineString([(0, 0), (1, 0)]), Polygon(), id="line"),
        pytest.param(SPoint(0, 0), Polygon(), id="point"),
    ],
)
def test_polygonal_part(geometry, expected):
    assert polygonal_part(geometry).equals(expected)


@pytest.mark.parametrize(
    ("overlap_area", "area1", "area2", "expected"),
    [
        pytest.param(1.0, 200.0, 1.0, 1.0, id="contained"),
        pytest.param(0.5, 1.0, 1.0, 0.5, id="equal halves"),
        # Rounding can make the overlap a hair larger than the smaller farm
        pytest.param(1.01, 1.0, 5.0, 1.0, id="capped at 1"),
        pytest.param(0.0, 1.0, 1.0, 0.0, id="no area"),
        pytest.param(0.0, 0.0, 0.0, 0.0, id="tiny farms"),
    ],
)
def test_get_overlap_ratio(overlap_area, area1, area2, expected):
    assert get_overlap_ratio(overlap_area, area1, area2) == expected


@pytest.mark.usefixtures("overlap_threshold_1")
@pytest.mark.parametrize(
    ("ratio", "expected"),
    [(0.0099, False), (0.01, False), (0.0101, True), (1.0, True)],
)
def test_overlap_threshold_is_strict(ratio, expected):
    assert is_overlap_above_threshold(ratio) is expected


@pytest.mark.parametrize(
    ("ratio", "expected"),
    [(0.5, "MEDIUM"), (0.8, "MEDIUM"), (0.8001, "HIGH"), (1.0, "HIGH")],
)
def test_overlap_criticality(ratio, expected):
    assert get_overlap_criticality(ratio) == expected


# --- /validate: a farm's geometry never fails the request -----------------------


@pytest.mark.usefixtures("overlap_threshold_1")
@pytest.mark.parametrize(
    ("path", "kind", "reason"),
    [
        pytest.param(
            [(0.0005, 0.0005)], "invalid_geometry", "Too few points", id="1 vertex"
        ),
        pytest.param(
            [(0, 0), (0.001, 0.001)],
            "invalid_geometry",
            "Too few points",
            id="2 vertices",
        ),
        pytest.param(
            [(0, 0), (0.0005, 0.0005), (0.001, 0.001)],
            "invalid_geometry",
            "Self-intersection",
            id="collinear",
        ),
        pytest.param(
            [(0, 0), (0.001, 0.001), (0.001, 0), (0, 0.001)],
            "invalid_geometry",
            "Self-intersection",
            id="bow-tie",
        ),
        pytest.param([], "empty_polygon", None, id="no vertices"),
    ],
)
def test_bad_geometry_is_reported_not_raised(path, kind, reason):
    # The bad farm sits on top of a valid one: it must not be part of an overlap
    statuses, inconsistencies = _validate(
        _farm("good", _box(0, 0, 1, 1)),
        _farm("bad", path),
        _farm("far", _box(5, 5, 6, 6)),
    )
    [inconsistency] = inconsistencies
    assert inconsistency["type"] == kind
    assert inconsistency["farmIds"] == ["bad"]
    if reason:
        assert inconsistency["data"]["reason"].startswith(reason)
    assert statuses == {"good": "VALID", "bad": "NOT_VALID", "far": "VALID"}


def test_type_and_details_mismatch_is_a_bad_request():
    farm = _farm("a", _box(0, 0, 1, 1))
    farm["type"] = "point"
    response = client.post("/polygons_validation/validate", json=[farm])
    assert response.status_code == 400


# --- Polygon coordinates from WKT and GeoJSON -----------------------------------

OUTER = [(0, 0), (0.01, 0), (0.01, 0.01), (0, 0.01), (0, 0)]
HOLE = [(0.004, 0.004), (0.006, 0.004), (0.006, 0.006), (0.004, 0.006), (0.004, 0.004)]


def _ring_wkt(ring):
    return "(" + ", ".join(f"{x} {y}" for x, y in ring) + ")"


def test_geojson_polygon_with_a_hole_keeps_the_outer_ring():
    geojson = json.dumps([OUTER, HOLE])
    coords = parse_farm_coordinates_string("GeoJSON", "Polygon", geojson)
    assert [(c.lng, c.lat) for c in coords] == OUTER
    polygon = generate_polygon(coords)
    assert polygon.is_valid
    assert GeometryCalculator.calculate_polygon_area(polygon) > 0


def test_same_polygon_in_wkt_and_geojson():
    wkt = f"POLYGON ({_ring_wkt(OUTER)}, {_ring_wkt(HOLE)})"
    from_wkt = parse_farm_coordinates_string("WKT", "Polygon", wkt)
    from_geojson = parse_farm_coordinates_string(
        "GeoJSON", "Polygon", json.dumps([OUTER, HOLE])
    )
    assert from_wkt == from_geojson
    assert GeometryCalculator.calculate_polygon_area(
        generate_polygon(from_wkt)
    ) == GeometryCalculator.calculate_polygon_area(generate_polygon(from_geojson))


def test_geojson_polygon_with_a_malformed_hole_is_rejected():
    geojson = json.dumps([OUTER, [[0.004, 0.004], [0.006]]])
    with pytest.raises(ValueError):
        parse_farm_coordinates_string("GeoJSON", "Polygon", geojson)
