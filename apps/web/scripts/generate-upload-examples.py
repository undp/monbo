# Regenerates the upload step's downloadable files, in Spanish and English:
#
# - public/files/m1-upload-file-template-geo-{es,en}.xlsx: option 3's template (an
#   Excel joined to a geo file by ID). It is the main template without its three
#   coordinate columns, with the ID marked mandatory, so the two can't drift.
# - public/files/examples/{es,en}/: one example per option, which upload without
#   errors (src/utils/uploadExamples.test.ts and the API's
#   tests/modules/farms/test_upload_examples.py check it):
#   - option 1: the main template filled in, with coordinates as GeoJSON and WKT;
#   - option 2: a GeoJSON with the accepted attribute names, and a zipped Shapefile
#     (polygons and points as two Shapefiles) with the short ones;
#   - option 3: a KML whose placemark names are the IDs, and its Excel, from the
#     option 3 template.
#
# The farms are in Costa Rica's Central Valley (coffee), 4 polygons and a point per
# file, with distinct IDs and places per file, so all of them can be uploaded
# together. None has a producer country: they upload whatever country is selected.
#
# Run it after changing the main templates (from the repo root), with the API's
# environment, which has openpyxl and geopandas:
#
#   uv run --directory apps/api python -I ../web/scripts/generate-upload-examples.py
#
# The output is deterministic (fixed timestamps in every zip and Excel), so an
# unchanged run leaves git clean.

import copy
import io
import json
import re
import tempfile
import zipfile
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path

import geopandas
import openpyxl
from openpyxl.utils import column_index_from_string, get_column_letter
from shapely.geometry import Point, Polygon
from shapely.geometry.polygon import orient

PUBLIC = Path(__file__).resolve().parent.parent / "public"
FILES = PUBLIC / "files"
LANGUAGES = ("es", "en")
# Every zip member and Excel gets this time, so the files only change with content
FIXED_TIME = (2026, 11, 1, 0, 0, 0)

# The main template's columns, 1-based: G, H and I place the farm
FIRST_COORDINATE_COLUMN = 7
COORDINATE_COLUMN_COUNT = 3
FIRST_DATA_ROW = 4

MANDATORY = {"es": "OBLIGATORIO", "en": "MANDATORY"}
# Row 3 is the template's example, which the upload skips: its ID shows the format
EXAMPLE_ID = {
    "es": "F-001\n(ejemplo: no borrar esta fila)",
    "en": "F-001\n(example: do not delete this row)",
}
DATE_FORMAT = {"es": 'dd"/"mm"/"yyyy', "en": 'yyyy"-"mm"-"dd'}

NAMES = {
    "es": {
        "option1": "opcion-1-plantilla-con-coordenadas.xlsx",
        "geojson": "opcion-2-fincas.geojson",
        "shapefile": "opcion-2-fincas-shapefile.zip",
        "shapefile_polygons": "fincas_poligonos",
        "shapefile_points": "fincas_puntos",
        "kml": "opcion-3-poligonos.kml",
        "kml_document": "Fincas de ejemplo (opción 3)",
        "option3": "opcion-3-datos-produccion.xlsx",
    },
    "en": {
        "option1": "option-1-template-with-coordinates.xlsx",
        "geojson": "option-2-farms.geojson",
        "shapefile": "option-2-farms-shapefile.zip",
        "shapefile_polygons": "farms_polygons",
        "shapefile_points": "farms_points",
        "kml": "option-3-polygons.kml",
        "kml_document": "Example farms (option 3)",
        "option3": "option-3-production-data.xlsx",
    },
}

CROP = {"es": "Café", "en": "Coffee"}
UNIT = "kg"
ASSOCIATION = "Cooperativa Cafetalera Tierra de Sabores"
DOCUMENT_NAME = {"es": "Título de propiedad", "en": "Land title"}

# Polygon outlines, in 1e-4 degrees (about 11 m) from the farm's corner: 3 to 5 ha
SHAPES = [
    [(0, 0), (17, 3), (21, -10), (9, -19), (-2, -11)],
    [(0, 0), (13, 2), (19, -7), (15, -17), (3, -16), (-3, -7)],
    [(0, 0), (24, 1), (23, -9), (12, -13), (1, -10)],
    [(0, 0), (9, 5), (20, 2), (18, -12), (6, -14), (-1, -6)],
]
FARM_SPACING = 0.004  # degrees between farms, west to east
POINT_AREA_HECTARES = 2.5


@dataclass(frozen=True)
class Producer:
    name: str
    production_date: date
    quantity: float
    association: str | None


# The same producers in every file; the fifth farm is a point
PRODUCERS = [
    Producer("Ana Lucía Mora", date(2025, 2, 14), 1850, ASSOCIATION),
    Producer("José Pablo Quesada", date(2025, 3, 3), 2400, ASSOCIATION),
    Producer("María Fernanda Solís", date(2025, 3, 21), 960.5, None),
    Producer("Luis Diego Arias", date(2025, 4, 8), 3100, ASSOCIATION),
    Producer("Rosa Elena Jiménez", date(2025, 4, 25), 720, None),
]


@dataclass(frozen=True)
class Farm:
    id: str
    producer: Producer
    region: str
    geometry: Polygon | Point

    @property
    def area(self) -> float | None:
        return POINT_AREA_HECTARES if isinstance(self.geometry, Point) else None


def farms(prefix: str, first: int, region: str, west: float, north: float):
    """Five farms in a row from (west, north): four polygons, then a point."""
    result = []
    for index, producer in enumerate(PRODUCERS):
        lng = west + index * FARM_SPACING
        if index < len(SHAPES):
            outline = [
                (round(lng + dx / 1e4, 6), round(north + dy / 1e4, 6))
                for dx, dy in SHAPES[index]
            ]
            # Counterclockwise outer rings, as RFC 7946 asks of GeoJSON
            geometry: Polygon | Point = orient(Polygon(outline), 1.0)
            assert geometry.is_valid
        else:
            geometry = Point(round(lng + 0.001, 6), round(north - 0.001, 6))
        farm_id = f"{prefix}-{first + index:03d}"
        result.append(Farm(farm_id, producer, region, geometry))
    return result


# Distinct places per file: the examples can be uploaded together without overlaps
OPTION_1 = farms("E1", 1, "Heredia", -84.1260, 10.0420)  # Barva
GEOJSON = farms("E2", 1, "Alajuela", -84.3900, 10.0950)  # Naranjo
SHAPEFILE = farms("E2", 6, "Alajuela", -84.3000, 10.0900)  # Grecia
OPTION_3 = farms("E3", 1, "Heredia", -84.1600, 10.0450)  # Santa Bárbara


def ring(polygon: Polygon) -> list[list[float]]:
    return [[x, y] for x, y in polygon.exterior.coords]


# --- Zip and Excel files -----------------------------------------------------------


def write_zip(path: Path, members: list[tuple[str, bytes]]) -> None:
    """A zip whose bytes only depend on its members."""
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, content in members:
            info = zipfile.ZipInfo(name, date_time=FIXED_TIME)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            archive.writestr(info, content)


def save_workbook(workbook: openpyxl.Workbook, path: Path) -> None:
    """Saves without the save time openpyxl writes, in the workbook or its zip."""
    buffer = io.BytesIO()
    workbook.save(buffer)
    modified = datetime(*FIXED_TIME).strftime("%Y-%m-%dT%H:%M:%SZ")
    members = []
    with zipfile.ZipFile(buffer) as archive:
        for name in archive.namelist():
            content = archive.read(name)
            if name == "docProps/core.xml":
                content = re.sub(
                    rb"(<dcterms:modified[^>]*>)[^<]*(</dcterms:modified>)",
                    rb"\g<1>" + modified.encode() + rb"\g<2>",
                    content,
                )
            members.append((name, content))
    write_zip(path, members)


def main_template(language: str) -> openpyxl.Workbook:
    return openpyxl.load_workbook(FILES / f"m1-upload-file-template-{language}.xlsx")


def geo_template(language: str) -> openpyxl.Workbook:
    """The main template without its coordinate columns, with the ID mandatory."""
    workbook = main_template(language)
    sheet = workbook.active

    # openpyxl moves the cells but not the column widths nor the hyperlinks
    widths = {
        column_index_from_string(letter): dimension.width
        for letter, dimension in sheet.column_dimensions.items()
        if dimension.customWidth
    }
    links = {
        (cell.row, cell.column): cell.hyperlink.target
        for row in sheet.iter_rows()
        for cell in row
        if cell.hyperlink
    }
    for cell in [sheet.cell(*position) for position in links]:
        cell.hyperlink = None

    sheet.delete_cols(FIRST_COORDINATE_COLUMN, COORDINATE_COLUMN_COUNT)
    last_coordinate_column = FIRST_COORDINATE_COLUMN + COORDINATE_COLUMN_COUNT - 1

    def moved(column: int) -> int | None:
        if column < FIRST_COORDINATE_COLUMN:
            return column
        if column > last_coordinate_column:
            return column - COORDINATE_COLUMN_COUNT
        return None

    sheet.column_dimensions.clear()
    for column, width in widths.items():
        new_column = moved(column)
        if new_column is not None:
            sheet.column_dimensions[get_column_letter(new_column)].width = width
    for (row, column), target in links.items():
        new_column = moved(column)
        if new_column is not None:
            sheet.cell(row, new_column).hyperlink = target

    # The ID joins each row to its polygon: mandatory, flagged as the others are
    id_flag = sheet["A1"]
    id_flag.value = MANDATORY[language]
    id_flag._style = copy.copy(sheet["B1"]._style)
    sheet["A3"].value = EXAMPLE_ID[language]
    return workbook


def fill(sheet, rows: list[list[object]], language: str) -> None:
    """Writes the farms from row 4, under the headers of row 2."""
    headers = [cell.value for cell in sheet[2]]
    date_column = headers.index(
        "Fecha producción" if language == "es" else "Production date"
    )
    for offset, values in enumerate(rows):
        for column, value in enumerate(values, start=1):
            cell = sheet.cell(FIRST_DATA_ROW + offset, column)
            cell.value = value
            if column == date_column + 1:
                cell.number_format = DATE_FORMAT[language]


def common_cells(farm: Farm, language: str) -> tuple[list, list]:
    """The cells before and after the coordinate columns."""
    producer = farm.producer
    documents = (
        [DOCUMENT_NAME[language], f"https://www.example.org/{farm.id}.pdf"]
        if farm.id.endswith("001")
        else []
    )
    before = [
        farm.id,
        producer.name,
        datetime.combine(producer.production_date, datetime.min.time()),
        producer.quantity,
        UNIT,
        farm.region,
    ]
    after = [farm.area, CROP[language], producer.association, *documents]
    return before, after


def coordinates(farm: Farm, index: int) -> list[str]:
    """Option 1's coordinate cells: GeoJSON for some farms, WKT for others."""
    geometry = farm.geometry
    geometry_type = "Point" if isinstance(geometry, Point) else "Polygon"
    if index in (2, 3):
        return ["WKT", geometry_type, geometry.wkt]
    if isinstance(geometry, Point):
        return ["GeoJSON", geometry_type, json.dumps([geometry.x, geometry.y])]
    return ["GeoJSON", geometry_type, json.dumps([ring(geometry)])]


def write_option_1(language: str, folder: Path) -> None:
    workbook = main_template(language)
    rows = []
    for index, farm in enumerate(OPTION_1):
        before, after = common_cells(farm, language)
        rows.append([*before, *coordinates(farm, index), *after])
    fill(workbook.active, rows, language)
    save_workbook(workbook, folder / NAMES[language]["option1"])


def write_geo_template(language: str) -> None:
    save_workbook(
        geo_template(language), FILES / f"m1-upload-file-template-geo-{language}.xlsx"
    )


def write_option_3_excel(language: str, folder: Path) -> None:
    workbook = geo_template(language)
    rows = []
    for farm in OPTION_3:
        before, after = common_cells(farm, language)
        rows.append([*before, *after])
    fill(workbook.active, rows, language)
    save_workbook(workbook, folder / NAMES[language]["option3"])


# --- Geo files ---------------------------------------------------------------------


def write_geojson(language: str, folder: Path) -> None:
    """The EUDR names (ProducerName, Area) and Monbo's own for the rest."""
    features = []
    for farm in GEOJSON:
        producer = farm.producer
        geometry = farm.geometry
        features.append(
            {
                "type": "Feature",
                "properties": {
                    "id": farm.id,
                    "ProducerName": producer.name,
                    "productionDate": producer.production_date.isoformat(),
                    "productionQuantity": producer.quantity,
                    "productionQuantityUnit": UNIT,
                    "cropType": CROP[language],
                    "Area": farm.area,
                    "region": farm.region,
                    "association": producer.association,
                },
                "geometry": (
                    {"type": "Point", "coordinates": [geometry.x, geometry.y]}
                    if isinstance(geometry, Point)
                    else {"type": "Polygon", "coordinates": [ring(geometry)]}
                ),
            }
        )
    content = json.dumps(
        {"type": "FeatureCollection", "features": features},
        ensure_ascii=False,
        indent=2,
    )
    (folder / NAMES[language]["geojson"]).write_text(content + "\n", encoding="utf-8")


def shapefile_frame(farm_list: list[Farm], language: str) -> geopandas.GeoDataFrame:
    """The short names, as a Shapefile's fields are at most 10 characters."""
    return geopandas.GeoDataFrame(
        {
            "ID": [farm.id for farm in farm_list],
            "PRODUCTOR": [farm.producer.name for farm in farm_list],
            # pyogrio only writes date-times, which a Shapefile lacks: ISO text
            "FECHA_PROD": [
                farm.producer.production_date.isoformat() for farm in farm_list
            ],
            "CANTIDAD": [float(farm.producer.quantity) for farm in farm_list],
            "UNIDAD": [UNIT for _ in farm_list],
            "CULTIVO": [CROP[language] for _ in farm_list],
            "AREA_HA": [farm.area for farm in farm_list],
            "REGION": [farm.region for farm in farm_list],
            "ASOCIACION": [farm.producer.association for farm in farm_list],
        },
        geometry=[farm.geometry for farm in farm_list],
        crs="EPSG:4326",
    )


def fixed_dbf_date(content: bytes) -> bytes:
    """A .dbf's header holds the day it was written (bytes 1-3: YY-1900, MM, DD)."""
    year, month, day = FIXED_TIME[:3]
    return content[:1] + bytes([year - 1900, month, day]) + content[4:]


def write_shapefile(language: str, folder: Path) -> None:
    """Polygons and points as two Shapefiles, at the zip's root."""
    names = NAMES[language]
    polygons = [farm for farm in SHAPEFILE if isinstance(farm.geometry, Polygon)]
    points = [farm for farm in SHAPEFILE if isinstance(farm.geometry, Point)]
    members = []
    with tempfile.TemporaryDirectory() as directory:
        for name, farm_list in (
            (names["shapefile_polygons"], polygons),
            (names["shapefile_points"], points),
        ):
            path = Path(directory) / f"{name}.shp"
            shapefile_frame(farm_list, language).to_file(
                path, engine="pyogrio", encoding="UTF-8"
            )
            for extension in (".shp", ".shx", ".dbf", ".prj", ".cpg"):
                content = path.with_suffix(extension).read_bytes()
                if extension == ".dbf":
                    content = fixed_dbf_date(content)
                members.append((f"{name}{extension}", content))
    write_zip(folder / names["shapefile"], members)


def kml_coordinates(coordinates) -> str:
    return " ".join(f"{x},{y},0" for x, y in coordinates)


def write_kml(language: str, folder: Path) -> None:
    """As Google Earth writes it: each placemark's name is its farm's ID, and it has
    no other data (option 3's Excel gives it)."""
    placemarks = []
    for farm in OPTION_3:
        geometry = farm.geometry
        if isinstance(geometry, Point):
            shape = (
                "<Point><coordinates>"
                f"{kml_coordinates([(geometry.x, geometry.y)])}"
                "</coordinates></Point>"
            )
        else:
            shape = (
                "<Polygon><outerBoundaryIs><LinearRing><coordinates>"
                f"{kml_coordinates(geometry.exterior.coords)}"
                "</coordinates></LinearRing></outerBoundaryIs></Polygon>"
            )
        placemarks.append(
            f"    <Placemark>\n      <name>{farm.id}</name>\n      {shape}\n"
            "    </Placemark>"
        )
    content = "\n".join(
        [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<kml xmlns="http://www.opengis.net/kml/2.2">',
            "  <Document>",
            f"    <name>{NAMES[language]['kml_document']}</name>",
            *placemarks,
            "  </Document>",
            "</kml>",
        ]
    )
    (folder / NAMES[language]["kml"]).write_text(content + "\n", encoding="utf-8")


def main() -> None:
    for language in LANGUAGES:
        folder = FILES / "examples" / language
        folder.mkdir(parents=True, exist_ok=True)
        write_geo_template(language)
        write_option_1(language, folder)
        write_geojson(language, folder)
        write_shapefile(language, folder)
        write_kml(language, folder)
        write_option_3_excel(language, folder)
        print(f"Wrote the {language} option 3 template and examples in {folder}")


if __name__ == "__main__":
    main()
