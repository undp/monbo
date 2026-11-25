"""Reads the farms of a geo file: GeoJSON, KML, KMZ or a zipped Shapefile.

Each feature comes back with its attributes and its geometry as WKT in EPSG:4326, so
the web can send it unchanged to `/farms/parse`. Problems with the whole file raise
`GeoImportError`; problems with one feature are reported on that feature, so the
user sees all of them at once.
"""

import math
import tempfile
import zipfile
from datetime import date, datetime, time
from pathlib import Path
from typing import Any, Literal
from xml.etree import ElementTree

import geopandas as gpd
import numpy as np
import pandas as pd
import pyogrio
import shapely
from shapely.geometry import MultiPolygon, Point, Polygon
from shapely.geometry.base import BaseGeometry

from app.config.logger import get_logger
from app.models.farms import ImportedFeature, ImportedFile, ImportIssue

logger = get_logger("farms.geo_import")

MAX_UPLOAD_MB = 20
MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024
# A KMZ or zipped Shapefile is read without extracting it, but GDAL still inflates
# its members: cap what they add up to (zip bomb).
MAX_UNCOMPRESSED_MB = 200
MAX_UNCOMPRESSED_BYTES = MAX_UNCOMPRESSED_MB * 1024 * 1024

# Extension -> format. The upload is stored under a fixed name with this extension,
# so GDAL picks the driver and the user's file name never reaches the file system.
FileFormat = Literal["geojson", "kml", "kmz", "shapefile"]
FORMATS: dict[str, FileFormat] = {
    ".geojson": "geojson",
    ".json": "geojson",
    ".kml": "kml",
    ".kmz": "kmz",
    ".zip": "shapefile",
}

# Columns the KML drivers add to every placemark, which never carry farm data.
KML_NOISE_COLUMNS = {
    "timestamp",
    "begin",
    "end",
    "altitudeMode",
    "tessellate",
    "extrude",
    "visibility",
    "drawOrder",
    "icon",
}

WGS84 = "EPSG:4326"


class GeoImportError(Exception):
    """A problem with the whole uploaded file. `code` and `params` let the web show
    it in the user's language; the English message is the fallback."""

    def __init__(self, code: str, message: str, status_code: int = 400, **params):
        super().__init__(message)
        self.code = code
        self.status_code = status_code
        self.params = params

    def as_issue(self) -> ImportIssue:
        return ImportIssue(code=self.code, message=str(self), params=self.params)


def file_too_large() -> GeoImportError:
    return GeoImportError(
        "file_too_large",
        f"The file is larger than {MAX_UPLOAD_MB} MB",
        status_code=413,
        maxMb=MAX_UPLOAD_MB,
    )


def import_geo_file(filename: str, content: bytes) -> ImportedFile:
    """The features of an uploaded geo file, in file order (every layer of a KML or
    KMZ, every Shapefile of a zip)."""
    extension = Path(filename).suffix.lower()
    file_format = FORMATS.get(extension)
    if file_format is None:
        raise GeoImportError(
            "unsupported_format",
            "Unsupported file type: upload a GeoJSON, KML, KMZ or zipped Shapefile",
            extension=extension,
        )
    if not content:
        raise GeoImportError("empty_file", "The file is empty")
    if len(content) > MAX_UPLOAD_BYTES:
        raise file_too_large()

    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / f"upload{extension}"
        path.write_bytes(content)
        features: list[ImportedFeature] = []
        placemark_ids = (
            _kml_placemark_ids(path, file_format)
            if file_format in ("kml", "kmz")
            else set()
        )
        for layer in _layers(path, file_format):
            for properties, geometry in _read_layer(layer, file_format):
                if file_format in ("kml", "kmz"):
                    properties = _kml_id(properties, placemark_ids)
                features.append(_feature(len(features) + 1, properties, geometry))

    if not features:
        raise GeoImportError("no_features", "The file has no features")
    return ImportedFile(format=file_format, features=features)


# --- Reading -----------------------------------------------------------------------


class _Layer:
    def __init__(self, dataset: str, name: str | None, label: str):
        self.dataset = dataset
        self.name = name
        # How the user knows the layer (the Shapefile's name in the zip).
        self.label = label


def _layers(path: Path, file_format: str) -> list[_Layer]:
    if file_format == "shapefile":
        members = _zip_members(path)
        shapefiles = [
            member
            for member in members
            if member.lower().endswith(".shp") and not member.startswith("__MACOSX/")
        ]
        if not shapefiles:
            raise GeoImportError("no_shapefile", "The zip file has no Shapefile (.shp)")
        # Read in place through GDAL's virtual file system: nothing is extracted.
        return [
            _Layer(f"/vsizip/{path}/{member}", None, member) for member in shapefiles
        ]

    if file_format == "kmz":
        _zip_members(path)  # checks it is a zip, and its uncompressed size
    try:
        names = [str(name) for name, _ in pyogrio.list_layers(path)]
    except Exception as exc:
        logger.info("Could not list the layers of an uploaded file: %s", exc)
        raise _unreadable() from exc
    return [_Layer(str(path), name, name) for name in names]


def _zip_members(path: Path) -> list[str]:
    try:
        with zipfile.ZipFile(path) as archive:
            infos = archive.infolist()
    except zipfile.BadZipFile as exc:
        raise _unreadable() from exc
    if sum(info.file_size for info in infos) > MAX_UNCOMPRESSED_BYTES:
        raise GeoImportError(
            "archive_too_large",
            f"The file's contents are larger than {MAX_UNCOMPRESSED_MB} MB "
            "once uncompressed",
            maxMb=MAX_UNCOMPRESSED_MB,
        )
    return [info.filename for info in infos if not info.is_dir()]


def _kml_placemark_ids(path: Path, file_format: str) -> set[str]:
    """The XML `id` attributes of a KML's placemarks (in a KMZ, of its .kml files).

    GDAL reads a placemark's XML id into the `id` column when the placemark has no
    `id` in its ExtendedData: an id like "fincas.1" from the exporting tool, which
    isn't the farm's. Those are recognised against this set and dropped."""
    try:
        if file_format == "kmz":
            with zipfile.ZipFile(path) as archive:
                documents = [
                    archive.read(name)
                    for name in archive.namelist()
                    if name.lower().endswith(".kml")
                ]
        else:
            documents = [path.read_bytes()]
        ids: set[str] = set()
        for document in documents:
            for element in ElementTree.fromstring(document).iter():
                xml_id = element.get("id")
                if element.tag.endswith("Placemark") and xml_id:
                    ids.add(xml_id)
        return ids
    except (ElementTree.ParseError, zipfile.BadZipFile, KeyError):
        # GDAL reports an unreadable file; here, nothing to drop
        return set()


def _kml_id(properties: dict[str, Any], placemark_ids: set[str]) -> dict[str, Any]:
    """A KML feature's `id` attribute: its ExtendedData `id`, never the placemark's
    XML id. With a typed schema GDAL puts the XML id in `id` and the ExtendedData
    `id` in `id2`."""
    properties = dict(properties)
    extended_id = properties.pop("id2", None)
    if extended_id not in (None, ""):
        properties["id"] = extended_id
    elif properties.get("id") in placemark_ids:
        properties["id"] = None
    return properties


def _unreadable() -> GeoImportError:
    return GeoImportError(
        "unreadable_file", "The file could not be read as a geographic file"
    )


def _read_layer(
    layer: _Layer, file_format: str
) -> list[tuple[dict[str, Any], BaseGeometry | None]]:
    try:
        frame = gpd.read_file(layer.dataset, layer=layer.name, engine="pyogrio")
    except Exception as exc:
        logger.info("Could not read an uploaded layer (%s): %s", layer.label, exc)
        raise _unreadable() from exc
    if frame.empty:
        return []

    if frame.crs is None:
        # Without a .prj the coordinates could be in any system: assuming WGS84
        # could place the farms anywhere. GeoJSON and KML are WGS84 by definition.
        if file_format == "shapefile":
            raise GeoImportError(
                "missing_prj",
                f"The Shapefile {layer.label} has no .prj file, so its coordinate "
                "system is unknown",
                layer=layer.label,
            )
        frame = frame.set_crs(WGS84)
    elif not frame.crs.equals(WGS84):
        frame = frame.to_crs(WGS84)

    geometry_column = frame.geometry.name
    columns = [
        column
        for column in frame.columns
        if column != geometry_column
        and not (file_format in ("kml", "kmz") and column in KML_NOISE_COLUMNS)
    ]
    records = frame[columns].to_dict("records")
    # Iterating the GeoSeries keeps a missing geometry as None (a row gives NaN).
    return [
        ({str(column): _json_safe(value) for column, value in record.items()}, geometry)
        for record, geometry in zip(records, frame.geometry)
    ]


def _json_safe(value: Any) -> str | int | float | bool | None:
    """An attribute value as JSON: dates as ISO strings, missing values as null."""
    if value is None:
        return None
    if isinstance(value, (bool, np.bool_)):
        return bool(value)
    if isinstance(value, (int, np.integer)):
        return int(value)
    if isinstance(value, (float, np.floating)):
        number = float(value)
        return number if math.isfinite(number) else None
    if isinstance(value, (pd.Timestamp, datetime, date, time)):
        return None if pd.isna(value) else value.isoformat()
    if isinstance(value, bytes):
        return None
    if isinstance(value, (list, tuple, np.ndarray)):
        return ", ".join(str(item) for item in value)
    if pd.isna(value):
        return None
    return str(value)


# --- Geometry ----------------------------------------------------------------------


def _feature(
    position: int, properties: dict[str, Any], geometry: BaseGeometry | None
) -> ImportedFeature:
    if geometry is None or geometry.is_empty:
        return ImportedFeature(
            position=position,
            properties=properties,
            errors=[
                ImportIssue(
                    code="empty_geometry",
                    message=f"Feature {position} has no geometry",
                    params={"position": position},
                )
            ],
        )

    # KML always carries an altitude, and /farms/parse rejects 3-value coordinates.
    geometry = shapely.force_2d(geometry)
    # A MultiPolygon of several parts is one farm of several parts
    if isinstance(geometry, MultiPolygon) and len(geometry.geoms) == 1:
        geometry = geometry.geoms[0]

    geometry_type: Literal["Point", "Polygon", "MultiPolygon"]
    if isinstance(geometry, MultiPolygon):
        geometry_type = "MultiPolygon"
    elif isinstance(geometry, Polygon):
        geometry_type = "Polygon"
    elif isinstance(geometry, Point):
        geometry_type = "Point"
    else:
        return ImportedFeature(
            position=position,
            properties=properties,
            errors=[
                ImportIssue(
                    code="unsupported_geometry",
                    message=f"Feature {position} is a {geometry.geom_type}: a farm "
                    "must be a Polygon or a Point",
                    params={"position": position, "geometryType": geometry.geom_type},
                )
            ],
        )

    # Holes and parts go to /farms/parse as they are: it keeps them.
    return ImportedFeature(
        position=position,
        properties=properties,
        geometryType=geometry_type,
        farmCoordinates=geometry.wkt,
    )
