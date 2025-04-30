from app.models.polygons import Point
from app.modules.polygons_validation.helpers import (
    detect_overlap,
    generate_polygon,
    get_geometry_paths,
    parse_farm_coordinates_data,
)
from app.utils.polygons import get_polygon_area
from shapely.geometry import Point as SPoint
from shapely.geometry import Polygon


def test_generate_polygon():
    """
    Test the generate_polygon function with different sets of points.
    This test covers two scenarios:
    1. When the input points form a polygon.
    2. When the input points form a single point.
    The function is expected to return a tuple containing the type of the
    generated shape ("polygon" or "point") and the generated shape itself.
    Test cases:
    1. A list of points forming a square polygon.
       - Input: points = [Point(x=0, y=0), Point(x=0, y=1), Point(x=1, y=1),
       Point(x=1, y=0)]
       - Expected output: ("polygon", Polygon([(0, 0), (0, 1), (1, 1), (1, 0)]))
    2. A single point.
       - Input: points = [SPoint(0, 0)]
       - Expected output: ("point", SPoint(0, 0).buffer(0.0009))
    Assertions:
    - The type of the generated shape should match the expected type.
    - The generated shape should be equal to the expected shape.
    """
    points = [
        Point(x=0, y=0),
        Point(x=0, y=1),
        Point(x=1, y=1),
        Point(x=1, y=0),
    ]

    expected_polygon = Polygon([(point.x, point.y) for point in points])
    (poly_type, polygon) = generate_polygon(points)
    assert poly_type == "polygon"
    assert expected_polygon.equals(polygon)

    points = [SPoint(0, 0)]
    expected_polygon = SPoint(0, 0).buffer(0.0009)
    (poly_type, polygon) = generate_polygon(points)
    assert poly_type == "point"
    assert expected_polygon.equals(polygon)


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

    assert len(detect_overlap([polygon1, polygon2])) == 1
    assert len(detect_overlap([polygon1, polygon3])) == 0


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
    poly1_area = get_polygon_area(polygon_1)
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
    poly2_area = get_polygon_area(polygon_2)
    assert abs(poly2_area - gee_poly2_area) / gee_poly2_area < 0.01


def test_parse_farm_coordinates_data():
    """
    Test the parse_farm_coordinates_data function.
    This test checks if the parse_farm_coordinates_data function correctly
    parses a string of coordinates into a list of Point objects.
    The input string is in the format "[(x1, y1), (x2, y2), ...]".
    The expected output is a list of Point objects with the corresponding
    x and y values.
    Test case:
    - input_coordinates: "[(0, 0), (1, 1), (2, 2)]"
    - expected_points: [Point(x=0, y=0), Point(x=1, y=1), Point(x=2, y=2)]
    Asserts:
    - The parsed coordinates match the expected list of Point objects.
    """
    input_coordinates = "[(0, 0), (1, 1), (2, 2)]"
    expected_points = [
        Point(x=0, y=0),
        Point(x=1, y=1),
        Point(x=2, y=2),
    ]

    assert parse_farm_coordinates_data(input_coordinates) == expected_points


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
