import pytest
from shapely.geometry import MultiPolygon, Polygon, box

from app.helpers.GeometryCalculator import GeometryCalculator

area = GeometryCalculator.calculate_polygon_area

# Squares that cross the equator with opposite latitudes. The projection the area
# was measured with (Albers, with the farm's latitudes as standard parallels) is
# undefined for them.
EQUATOR_30_HA = box(-0.0025, -0.0025, 0.0025, 0.0025)
EQUATOR_300_HA = box(-0.008, -0.008, 0.008, 0.008)


@pytest.mark.parametrize(
    ("farm", "hectares"),
    [
        pytest.param(EQUATOR_30_HA, 30.77, id="30 ha"),
        pytest.param(EQUATOR_300_HA, 315.11, id="300 ha"),
    ],
)
def test_farm_symmetric_about_the_equator(farm, hectares):
    assert area(farm) / 10_000 == pytest.approx(hectares, abs=0.01)


# Areas the previous method (Albers projections) gave, in m², to the cm²
@pytest.mark.parametrize(
    ("farm", "expected"),
    [
        pytest.param(box(-84.37, 10.14, -84.3684, 10.1416), 31031.84, id="CR 3 ha"),
        pytest.param(box(-84.37, 10.14, -84.36, 10.15), 1212165.62, id="CR 121 ha"),
        pytest.param(box(-78.5, -0.2, -78.49, -0.19), 1230900.27, id="EC 123 ha"),
        pytest.param(box(5, 45, 5.01, 45.01), 876163.45, id="45°N 88 ha"),
        pytest.param(box(-70, -60, -69.995, -59.9985), 46627.09, id="60°S 5 ha"),
    ],
)
def test_ordinary_farms_keep_their_area(farm, expected):
    assert area(farm) == expected


def _square_m(lng, lat, side_deg):
    return box(lng, lat, lng + side_deg, lat + side_deg)


def test_holes_are_subtracted_and_parts_added():
    exterior = _square_m(-84.37, 10.14, 0.003)
    hole = _square_m(-84.369, 10.141, 0.001)
    second = _square_m(-84.36, 10.14, 0.002)
    farm = MultiPolygon([Polygon(exterior.exterior, [hole.exterior]), second])
    assert area(farm) == pytest.approx(
        area(exterior) - area(hole) + area(second), abs=0.02
    )


def test_ring_orientation_doesnt_change_the_area():
    exterior = list(_square_m(-84.37, 10.14, 0.003).exterior.coords)
    hole = list(_square_m(-84.369, 10.141, 0.001).exterior.coords)
    counter_clockwise = Polygon(exterior, [list(reversed(hole))])
    clockwise = Polygon(list(reversed(exterior)), [hole])
    assert area(clockwise) == area(counter_clockwise) > 0


def test_invalid_and_empty_polygons():
    bowtie = Polygon([(0, 0), (0.001, 0.001), (0.001, 0), (0, 0.001)])
    assert area(bowtie) == -1
    assert area(Polygon()) == 0


def test_a_polygon_beyond_the_poles_has_no_area():
    # Shapely accepts it, but there is no such place on the ellipsoid: pyproj
    # gives NaN, which must not reach a response as a null area
    assert area(box(0, 95, 1, 96)) == -1
