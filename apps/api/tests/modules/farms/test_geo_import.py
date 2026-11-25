import zipfile
from pathlib import Path

import geopandas as gpd
import pytest
from fastapi.testclient import TestClient
from shapely import wkt
from shapely.geometry import MultiPolygon, Point, Polygon

from app.main import app
from app.modules.farms import geo_import

client = TestClient(app)

POLYGON = Polygon(
    [(-84.023, 9.8783), (-84.0201, 9.879), (-84.0195, 9.8761), (-84.0226, 9.8755)]
)
OTHER_POLYGON = Polygon(
    [(-84.015, 9.88), (-84.012, 9.8805), (-84.0118, 9.878), (-84.0148, 9.8776)]
)
POINT = Point(-84.01, 9.87)


def _frame(rows: list[dict], crs: str | None = "EPSG:4326") -> gpd.GeoDataFrame:
    return gpd.GeoDataFrame(rows, geometry="geometry", crs=crs)


def _upload(name: str, content: bytes):
    return client.post("/farms/import", files={"file": (name, content)})


def _write(frame: gpd.GeoDataFrame, path: Path, driver: str) -> bytes:
    frame.to_file(path, driver=driver, engine="pyogrio")
    return path.read_bytes()


def _zip_shapefiles(tmp_path: Path, frames: dict[str, gpd.GeoDataFrame]) -> bytes:
    archive = tmp_path / "farms.zip"
    with zipfile.ZipFile(archive, "w") as zipped:
        for name, frame in frames.items():
            folder = tmp_path / name
            folder.mkdir()
            frame.to_file(folder / f"{name}.shp", engine="pyogrio")
            for file in folder.iterdir():
                zipped.write(file, f"{name}/{file.name}")
    return archive.read_bytes()


def test_geojson_features_come_back_as_wkt_with_their_properties(tmp_path):
    content = _write(
        _frame(
            [
                {"id": "F-1", "quantity": 1200, "geometry": POLYGON},
                {"id": "F-2", "quantity": None, "geometry": POINT},
            ]
        ),
        tmp_path / "farms.geojson",
        "GeoJSON",
    )

    response = _upload("farms.geojson", content)

    assert response.status_code == 200
    [polygon, point] = response.json()["features"]
    assert polygon["position"] == 1
    assert polygon["properties"] == {"id": "F-1", "quantity": 1200}
    assert polygon["geometryType"] == "Polygon"
    assert wkt.loads(polygon["farmCoordinates"]).equals(POLYGON)
    assert polygon["errors"] == []
    assert point["position"] == 2
    assert point["properties"] == {"id": "F-2", "quantity": None}
    assert point["geometryType"] == "Point"
    assert point["farmCoordinates"] == "POINT (-84.01 9.87)"


def test_geojson_in_another_crs_is_reprojected_to_wgs84(tmp_path):
    projected = _frame([{"id": 1, "geometry": POINT}]).to_crs("EPSG:5367")
    content = _write(projected, tmp_path / "farms.geojson", "GeoJSON")

    [feature] = _upload("farms.json", content).json()["features"]

    point = wkt.loads(feature["farmCoordinates"])
    assert point.x == pytest.approx(POINT.x)
    assert point.y == pytest.approx(POINT.y)


def test_kml_reads_every_folder_drops_noise_and_altitude(tmp_path):
    path = tmp_path / "farms.kml"
    _frame(
        [
            {
                "Name": "F-1",
                "geometry": Polygon([(*c, 1500) for c in POLYGON.exterior.coords]),
            }
        ]
    ).to_file(path, driver="LIBKML", layer="polygons", engine="pyogrio")
    _frame([{"Name": "F-2", "geometry": Point(POINT.x, POINT.y, 1500)}]).to_file(
        path, driver="LIBKML", layer="points", engine="pyogrio", append=True
    )

    response = _upload("farms.kml", path.read_bytes())

    assert response.status_code == 200
    features = response.json()["features"]
    assert [f["properties"]["Name"] for f in features] == ["F-1", "F-2"]
    assert [f["position"] for f in features] == [1, 2]
    assert [f["geometryType"] for f in features] == ["Polygon", "Point"]
    assert all("tessellate" not in f["properties"] for f in features)
    assert all(not wkt.loads(f["farmCoordinates"]).has_z for f in features)
    assert "Z" not in features[0]["farmCoordinates"]


def test_kmz_is_read(tmp_path):
    content = _write(
        _frame([{"Name": "F-1", "geometry": POLYGON}]), tmp_path / "farms.kmz", "LIBKML"
    )

    [feature] = _upload("farms.kmz", content).json()["features"]

    assert feature["properties"]["Name"] == "F-1"
    assert feature["geometryType"] == "Polygon"


def test_zip_with_a_polygons_and_a_points_shapefile_reads_both(tmp_path):
    content = _zip_shapefiles(
        tmp_path,
        {
            "polygons": _frame(
                [
                    {"ID": "F-1", "geometry": POLYGON},
                    {"ID": "F-2", "geometry": OTHER_POLYGON},
                ]
            ),
            "points": _frame([{"ID": 3, "geometry": POINT}]),
        },
    )

    response = _upload("farms.zip", content)

    assert response.status_code == 200
    features = response.json()["features"]
    assert sorted(str(f["properties"]["ID"]) for f in features) == ["3", "F-1", "F-2"]
    assert [f["position"] for f in features] == [1, 2, 3]
    assert sorted(f["geometryType"] for f in features) == [
        "Point",
        "Polygon",
        "Polygon",
    ]


def test_shapefile_without_prj_is_rejected(tmp_path):
    folder = tmp_path / "farms"
    folder.mkdir()
    _frame([{"ID": "F-1", "geometry": POLYGON}]).to_file(
        folder / "farms.shp", engine="pyogrio"
    )
    archive = tmp_path / "farms.zip"
    with zipfile.ZipFile(archive, "w") as zipped:
        for file in folder.iterdir():
            if file.suffix != ".prj":
                zipped.write(file, file.name)

    response = _upload("farms.zip", archive.read_bytes())

    assert response.status_code == 400
    assert response.json()["detail"]["code"] == "missing_prj"
    assert response.json()["detail"]["params"] == {"layer": "farms.shp"}


def test_zip_without_shapefile_is_rejected(tmp_path):
    archive = tmp_path / "farms.zip"
    with zipfile.ZipFile(archive, "w") as zipped:
        zipped.writestr("readme.txt", "no shapefile here")

    response = _upload("farms.zip", archive.read_bytes())

    assert response.status_code == 400
    assert response.json()["detail"]["code"] == "no_shapefile"


def test_zip_bomb_is_rejected_before_reading(tmp_path, monkeypatch):
    monkeypatch.setattr(geo_import, "MAX_UNCOMPRESSED_BYTES", 1000)
    archive = tmp_path / "farms.zip"
    with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED) as zipped:
        zipped.writestr("farms.shp", b"\0" * 2000)

    response = _upload("farms.zip", archive.read_bytes())

    assert response.status_code == 400
    assert response.json()["detail"]["code"] == "archive_too_large"


def test_multipolygons_of_one_part_are_polygons_and_of_several_stay_multipolygons(
    tmp_path,
):
    content = _write(
        _frame(
            [
                {"id": "one", "geometry": MultiPolygon([POLYGON])},
                {"id": "two", "geometry": MultiPolygon([POLYGON, OTHER_POLYGON])},
            ]
        ),
        tmp_path / "farms.geojson",
        "GeoJSON",
    )

    [single, multiple] = _upload("farms.geojson", content).json()["features"]

    assert single["geometryType"] == "Polygon"
    assert wkt.loads(single["farmCoordinates"]).equals(POLYGON)
    assert single["errors"] == []
    # One farm of two parts
    assert multiple["geometryType"] == "MultiPolygon"
    assert wkt.loads(multiple["farmCoordinates"]).equals(
        MultiPolygon([POLYGON, OTHER_POLYGON])
    )
    assert multiple["errors"] == []


def test_lines_and_empty_geometries_are_feature_errors():
    content = (
        b'{"type": "FeatureCollection", "features": ['
        b'{"type": "Feature", "properties": {"id": "a"}, "geometry": '
        b'{"type": "LineString", "coordinates": [[-84, 9], [-84.1, 9.1]]}},'
        b'{"type": "Feature", "properties": {"id": "b"}, "geometry": null}]}'
    )

    [line, empty] = _upload("farms.geojson", content).json()["features"]

    assert line["errors"][0]["code"] == "unsupported_geometry"
    assert line["errors"][0]["params"] == {"position": 1, "geometryType": "LineString"}
    assert empty["errors"][0]["code"] == "empty_geometry"


def test_oversized_upload_is_rejected(monkeypatch):
    monkeypatch.setattr(geo_import, "MAX_UPLOAD_BYTES", 10)

    response = _upload("farms.geojson", b"x" * 11)

    assert response.status_code == 413
    assert response.json()["detail"]["code"] == "file_too_large"
    assert response.json()["detail"]["params"] == {"maxMb": geo_import.MAX_UPLOAD_MB}


@pytest.mark.parametrize(
    "name, content, code",
    [
        ("farms.xlsx", b"not geo", "unsupported_format"),
        ("farms.geojson", b"", "empty_file"),
        ("farms.geojson", b"not geojson", "unreadable_file"),
        ("farms.kmz", b"not a zip", "unreadable_file"),
        (
            "farms.geojson",
            b'{"type": "FeatureCollection", "features": []}',
            "no_features",
        ),
    ],
)
def test_file_level_problems_are_400_with_a_code(name, content, code):
    response = _upload(name, content)

    assert response.status_code == 400
    assert response.json()["detail"]["code"] == code
    assert response.json()["detail"]["message"]


def test_imported_features_are_accepted_by_the_parser(tmp_path):
    content = _write(
        _frame([{"id": "F-1", "geometry": POLYGON}, {"id": "F-2", "geometry": POINT}]),
        tmp_path / "farms.geojson",
        "GeoJSON",
    )
    features = _upload("farms.geojson", content).json()["features"]

    rows = [
        {
            "id": feature["properties"]["id"],
            "producerName": "Producer",
            "productionDate": "2025-01-01",
            "productionQuantity": 10,
            "productionQuantityUnit": "kg",
            "country": "CR",
            "coordinatesFormat": "WKT",
            "geometryType": feature["geometryType"],
            "farmCoordinates": feature["farmCoordinates"],
            "cropType": "Coffee",
            "area": 2,
            "documents": [],
        }
        for feature in features
    ]
    response = client.post("/farms/parse?locale=en", json=rows)

    assert response.status_code == 200
    assert [farm["polygon"]["type"] for farm in response.json()] == ["polygon", "point"]


# --- KML ids ------------------------------------------------------------------------

KML_POLYGON = (
    "<Polygon><outerBoundaryIs><LinearRing><coordinates>"
    "-84,9 -84.01,9 -84.01,9.01 -84,9"
    "</coordinates></LinearRing></outerBoundaryIs></Polygon>"
)


def _kml(*placemarks: str) -> bytes:
    return (
        '<?xml version="1.0"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document>'
        + "".join(placemarks)
        + "</Document></kml>"
    ).encode()


@pytest.mark.parametrize(
    ("placemark", "expected_id"),
    [
        pytest.param(
            '<Placemark id="fincas.1"><name>N1</name><ExtendedData>'
            '<Data name="id"><value>F-001</value></Data></ExtendedData>'
            f"{KML_POLYGON}</Placemark>",
            "F-001",
            id="XML id and ExtendedData id",
        ),
        pytest.param(
            '<Placemark id="fincas.1"><name>N1</name>' f"{KML_POLYGON}</Placemark>",
            None,
            id="XML id only",
        ),
        pytest.param(
            f"<Placemark><name>N1</name>{KML_POLYGON}</Placemark>",
            None,
            id="name only (Google Earth)",
        ),
    ],
)
def test_kml_id_is_the_extended_data_id_never_the_xml_id(placemark, expected_id):
    body = _upload("farms.kml", _kml(placemark)).json()
    assert body["format"] == "kml"
    [feature] = body["features"]
    assert feature["properties"]["id"] == expected_id
    assert feature["properties"]["Name"] == "N1"
    assert "id2" not in feature["properties"]


def test_kml_typed_schema_id_comes_from_id2(tmp_path):
    # GDAL's KML driver writes a typed schema: on reading, the placemark's XML id is
    # in `id` and the attribute `id` in `id2`
    frame = gpd.GeoDataFrame({"id": ["F-001"], "geometry": [POLYGON]}, crs="EPSG:4326")
    path = tmp_path / "farms.kml"
    frame.to_file(path, driver="KML", engine="pyogrio")

    [feature] = _upload("farms.kml", path.read_bytes()).json()["features"]

    assert feature["properties"]["id"] == "F-001"


def test_the_format_is_returned(tmp_path):
    content = _write(
        _frame([{"id": "a", "geometry": POLYGON}]), tmp_path / "a.geojson", "GeoJSON"
    )
    assert _upload("farms.geojson", content).json()["format"] == "geojson"
