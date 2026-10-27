import json
import math

import pytest
from fastapi.testclient import TestClient
from shapely.geometry import (
    GeometryCollection,
    LinearRing,
    LineString,
    MultiPolygon,
    Polygon,
)
from shapely.geometry import Point as SPoint

from app.helpers.GeometryCalculator import GeometryCalculator
from app.main import app
from app.models.polygons import Coordinates
from app.modules.polygons_validation.helpers import (
    detect_overlaps,
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
    geometry_to_parts,
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
    """A WKT polygon is parsed into the same Shapely polygon."""
    geometry = parse_farm_coordinates_string(
        "WKT", "Polygon", "POLYGON((0 0, 1 1, 2 2, 0 0))"
    )
    assert geometry.equals(Polygon([(0, 0), (1, 1), (2, 2)]))


def test_geometry_to_parts_orients_the_rings():
    """The exterior comes back counter-clockwise and the holes clockwise, whatever
    the input's orientation, so Google Maps draws the holes empty."""
    clockwise = [(0, 0), (0, 1), (1, 1), (1, 0), (0, 0)]
    counter_clockwise_hole = [(0.4, 0.4), (0.6, 0.4), (0.6, 0.6), (0.4, 0.6)]
    [part] = geometry_to_parts(Polygon(clockwise, [counter_clockwise_hole]))
    exterior = [(c.lng, c.lat) for c in part.exterior]
    [hole] = [[(c.lng, c.lat) for c in ring] for ring in part.holes]
    assert exterior == [(0, 0), (1, 0), (1, 1), (0, 1), (0, 0)]
    assert LinearRing(exterior).is_ccw
    assert not LinearRing(hole).is_ccw


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
                "parts": [{"exterior": [{"lat": 1.0, "lng": 2.0}], "holes": []}],
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


def _ring(points):
    return [{"lng": lng, "lat": lat} for lng, lat in points]


def _multi_farm(farm_id, *parts):
    """A farm of several parts, each an (exterior, holes) pair."""
    exterior = parts[0][0] if parts else []
    return {
        "id": farm_id,
        "type": "polygon",
        "details": {
            "center": (
                {"lng": exterior[0][0], "lat": exterior[0][1]}
                if exterior
                else {"lng": 0, "lat": 0}
            ),
            "parts": [
                {"exterior": _ring(ext), "holes": [_ring(h) for h in holes]}
                for ext, holes in parts
            ],
        },
    }


def _farm(farm_id, path, holes=()):
    return _multi_farm(farm_id, (path, holes))


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
    [part] = overlap["data"]["parts"]
    path = part["exterior"]
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


# --- /validate: holes and parts -------------------------------------------------


@pytest.mark.usefixtures("overlap_threshold_1")
def test_farm_inside_another_farms_hole_doesnt_overlap_it():
    statuses, inconsistencies = _validate(
        _farm("ring", _box(0, 0, 10, 10), [_box(3, 3, 7, 7)]),
        _farm("inside", _box(4, 4, 6, 6)),
    )
    assert inconsistencies == []
    assert statuses == {"ring": "VALID", "inside": "VALID"}


@pytest.mark.usefixtures("overlap_threshold_1")
def test_overlap_with_one_part_of_a_multipolygon():
    # Two parts of 4 units; the other farm (4 units) overlaps one of them by 1
    statuses, inconsistencies = _validate(
        _multi_farm("two-parts", (_box(0, 0, 2, 2), []), (_box(10, 10, 12, 12), [])),
        _farm("other", _box(1, 1, 3, 3)),
    )
    [overlap] = _overlaps(inconsistencies)
    assert overlap["data"]["percentage"] == pytest.approx(0.25, abs=1e-3)
    assert statuses == {"two-parts": "NOT_VALID", "other": "NOT_VALID"}


@pytest.mark.usefixtures("overlap_threshold_1")
def test_overlap_area_keeps_its_hole():
    # B lies inside A's exterior and covers A's hole: they overlap in B minus the hole
    _, inconsistencies = _validate(
        _farm("a", _box(0, 0, 10, 10), [_box(4, 4, 6, 6)]),
        _farm("b", _box(2, 2, 8, 8)),
    )
    [overlap] = _overlaps(inconsistencies)
    [part] = overlap["data"]["parts"]
    assert len(part["holes"]) == 1
    # 36 - 4 units of B's 36
    assert overlap["data"]["percentage"] == pytest.approx(32 / 36, abs=1e-3)


@pytest.mark.usefixtures("overlap_threshold_1")
@pytest.mark.parametrize(
    "farm",
    [
        pytest.param(
            _farm("bad", _box(0, 0, 2, 2), [_box(5, 5, 6, 6)]), id="hole outside"
        ),
        pytest.param(
            _multi_farm("bad", (_box(0, 0, 2, 2), []), (_box(1, 1, 3, 3), [])),
            id="overlapping parts",
        ),
    ],
)
def test_bad_holes_and_parts_are_invalid_geometries(farm):
    statuses, inconsistencies = _validate(farm, _farm("far", _box(20, 20, 21, 21)))
    [inconsistency] = inconsistencies
    assert inconsistency["type"] == "invalid_geometry"
    assert inconsistency["farmIds"] == ["bad"]
    assert statuses == {"bad": "NOT_VALID", "far": "VALID"}


def test_farm_with_a_hole_and_two_parts_is_valid():
    statuses, inconsistencies = _validate(
        _multi_farm(
            "farm", (_box(0, 0, 4, 4), [_box(1, 1, 2, 2)]), (_box(6, 0, 8, 2), [])
        )
    )
    assert inconsistencies == []
    assert statuses == {"farm": "VALID"}


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
# A second part about 5.5 km east
FAR = [(0.05, 0), (0.06, 0), (0.06, 0.01), (0.05, 0.01), (0.05, 0)]
MULTI = [[OUTER, HOLE], [FAR]]


def _ring_wkt(ring):
    return "(" + ", ".join(f"{x} {y}" for x, y in ring) + ")"


def _polygon_wkt(*rings):
    return "POLYGON (" + ", ".join(_ring_wkt(ring) for ring in rings) + ")"


def _multipolygon_wkt(*polygons):
    return (
        "MULTIPOLYGON ("
        + ", ".join(
            "(" + ", ".join(_ring_wkt(ring) for ring in rings) + ")"
            for rings in polygons
        )
        + ")"
    )


@pytest.mark.parametrize(
    "coordinates_format, coordinates",
    [
        ("GeoJSON", json.dumps([OUTER, HOLE])),
        ("WKT", _polygon_wkt(OUTER, HOLE)),
    ],
)
def test_polygon_with_a_hole_keeps_it(coordinates_format, coordinates):
    geometry = parse_farm_coordinates_string(coordinates_format, "Polygon", coordinates)
    assert geometry.equals(Polygon(OUTER, [HOLE]))
    assert GeometryCalculator.calculate_polygon_area(
        geometry
    ) < GeometryCalculator.calculate_polygon_area(Polygon(OUTER))


def test_same_single_ring_polygon_in_wkt_and_geojson():
    from_wkt = parse_farm_coordinates_string("WKT", "Polygon", _polygon_wkt(OUTER))
    from_geojson = parse_farm_coordinates_string(
        "GeoJSON", "Polygon", json.dumps([OUTER])
    )
    assert from_wkt.equals(from_geojson)
    assert GeometryCalculator.calculate_polygon_area(
        from_wkt
    ) == GeometryCalculator.calculate_polygon_area(from_geojson)


@pytest.mark.parametrize("geometry_type", ["Polygon", "MultiPolygon"])
@pytest.mark.parametrize(
    "coordinates_format, coordinates",
    [
        ("GeoJSON", json.dumps(MULTI)),
        ("WKT", _multipolygon_wkt(*MULTI)),
    ],
)
def test_multipolygon_is_accepted_as_either_type(
    geometry_type, coordinates_format, coordinates
):
    geometry = parse_farm_coordinates_string(
        coordinates_format, geometry_type, coordinates
    )
    assert geometry.equals(MultiPolygon([Polygon(OUTER, [HOLE]), Polygon(FAR)]))


def test_simple_polygon_declared_as_multipolygon():
    geometry = parse_farm_coordinates_string(
        "GeoJSON", "MultiPolygon", json.dumps([OUTER])
    )
    assert geometry.equals(Polygon(OUTER))


@pytest.mark.parametrize(
    "geometry_type, coordinates_format, coordinates",
    [
        pytest.param("Polygon", "WKT", "POINT (1 2)", id="WKT point as polygon"),
        pytest.param("Polygon", "GeoJSON", "[1, 2]", id="GeoJSON point as polygon"),
        pytest.param("Point", "WKT", _polygon_wkt(OUTER), id="WKT polygon as point"),
        pytest.param(
            "Point", "GeoJSON", json.dumps([OUTER]), id="GeoJSON polygon as point"
        ),
        pytest.param(
            "Point", "WKT", _multipolygon_wkt(*MULTI), id="multipolygon as point"
        ),
    ],
)
def test_point_and_polygon_types_must_match(
    geometry_type, coordinates_format, coordinates
):
    with pytest.raises(ValueError):
        parse_farm_coordinates_string(coordinates_format, geometry_type, coordinates)


@pytest.mark.parametrize(
    "coordinates_format, coordinates",
    [
        ("WKT", "LINESTRING (0 0, 1 1)"),
        ("WKT", "MULTIPOINT ((0 0), (1 1))"),
        ("GeoJSON", json.dumps([[0, 0], [1, 1]])),
    ],
)
def test_other_geometries_are_rejected(coordinates_format, coordinates):
    with pytest.raises(ValueError):
        parse_farm_coordinates_string(coordinates_format, "Polygon", coordinates)


def test_geojson_polygon_with_a_malformed_hole_is_rejected():
    geojson = json.dumps([OUTER, [[0.004, 0.004], [0.006]]])
    with pytest.raises(ValueError):
        parse_farm_coordinates_string("GeoJSON", "Polygon", geojson)


def _upload_row(coordinates_format, coordinates, geometry_type="Polygon"):
    return {
        "id": "F01",
        "producerName": "Producer",
        "productionDate": "2025-01-15",
        "productionQuantity": 100,
        "productionQuantityUnit": "kg",
        "country": "EC",
        "coordinatesFormat": coordinates_format,
        "geometryType": geometry_type,
        "farmCoordinates": coordinates,
        "cropType": "Café",
        "documents": [],
    }


def _parse_farm(coordinates_format, coordinates, geometry_type="Polygon"):
    response = client.post(
        "/farms/parse",
        json=[_upload_row(coordinates_format, coordinates, geometry_type)],
    )
    assert response.status_code == 200, response.text
    [farm] = response.json()
    return farm


def _points(ring):
    return [(c["lng"], c["lat"]) for c in ring]


@pytest.mark.parametrize(
    "coordinates_format, coordinates",
    [
        ("GeoJSON", json.dumps([OUTER, HOLE])),
        ("WKT", _polygon_wkt(OUTER, HOLE)),
    ],
)
def test_farm_with_a_hole_is_parsed_with_it(coordinates_format, coordinates):
    farm = _parse_farm(coordinates_format, coordinates)
    [part] = farm["polygon"]["details"]["parts"]
    [hole] = part["holes"]
    assert Polygon(_points(part["exterior"]), [_points(hole)]).equals(
        Polygon(OUTER, [HOLE])
    )
    assert farm["polygon"]["area"] == GeometryCalculator.calculate_polygon_area(
        Polygon(OUTER, [HOLE])
    )


@pytest.mark.parametrize("geometry_type", ["Polygon", "MultiPolygon"])
def test_multipolygon_is_one_farm_with_its_parts(geometry_type):
    farm = _parse_farm("WKT", _multipolygon_wkt(*MULTI), geometry_type)
    assert farm["id"] == "F01"
    assert farm["polygon"]["type"] == "polygon"
    parts = farm["polygon"]["details"]["parts"]
    assert [len(part["holes"]) for part in parts] == [1, 0]
    assert farm["polygon"]["area"] == pytest.approx(
        GeometryCalculator.calculate_polygon_area(
            MultiPolygon([Polygon(OUTER, [HOLE]), Polygon(FAR)])
        )
    )


def test_farm_rings_are_oriented():
    clockwise_outer = list(reversed(OUTER))
    counter_clockwise_hole = list(reversed(HOLE))
    farm = _parse_farm("WKT", _polygon_wkt(clockwise_outer, counter_clockwise_hole))
    [part] = farm["polygon"]["details"]["parts"]
    assert LinearRing(_points(part["exterior"])).is_ccw
    assert not LinearRing(_points(part["holes"][0])).is_ccw


def _center(farm):
    center = farm["polygon"]["details"]["center"]
    return SPoint(center["lng"], center["lat"])


def test_convex_farm_center_is_its_centroid():
    farm = _parse_farm("WKT", _polygon_wkt(OUTER))
    assert _center(farm).equals_exact(Polygon(OUTER).centroid, 1e-12)


def test_ring_shaped_farm_center_is_inside_it():
    # The hole covers the centroid
    big_hole = [
        (0.001, 0.001),
        (0.009, 0.001),
        (0.009, 0.009),
        (0.001, 0.009),
        (0.001, 0.001),
    ]
    farm = _parse_farm("WKT", _polygon_wkt(OUTER, big_hole))
    assert Polygon(OUTER, [big_hole]).contains(_center(farm))


def test_two_part_farm_center_is_inside_a_part():
    farm = _parse_farm("WKT", _multipolygon_wkt([OUTER], [FAR]))
    center = _center(farm)
    assert Polygon(OUTER).contains(center) or Polygon(FAR).contains(center)


def test_farm_with_a_single_ring_is_accepted_at_upload():
    farm = _parse_farm("GeoJSON", json.dumps([OUTER]))
    assert farm["polygon"]["area"] > 0
    [part] = farm["polygon"]["details"]["parts"]
    assert part["holes"] == []


# --- Farms across the equator ----------------------------------------------------

# About 300 ha, from latitude −0.008 to +0.008: opposite latitudes made the area's
# projection undefined
EQUATOR_RING = [
    (-0.008, -0.008),
    (0.008, -0.008),
    (0.008, 0.008),
    (-0.008, 0.008),
    (-0.008, -0.008),
]


def test_farm_symmetric_about_the_equator_is_uploaded():
    farm = _parse_farm("GeoJSON", json.dumps([EQUATOR_RING]))
    assert farm["polygon"]["area"] / 10_000 == pytest.approx(315.11, abs=0.01)


@pytest.mark.usefixtures("overlap_threshold_1")
def test_overlap_symmetric_about_the_equator_is_reported():
    # They overlap from latitude −0.008 to +0.008, in half of the smaller farm
    statuses, inconsistencies = _validate(
        _farm("a", _box(-8, -8, 8, 8)), _farm("b", _box(0, -8, 20, 8))
    )
    [overlap] = _overlaps(inconsistencies)
    assert overlap["data"]["percentage"] == pytest.approx(0.5, abs=1e-3)
    assert statuses == {"a": "NOT_VALID", "b": "NOT_VALID"}
