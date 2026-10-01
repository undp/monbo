"""Raster checks and conversion shared by admin ingestion and the seed command.

Nothing here touches the layers index: it validates one GeoTIFF, converts it to a
Cloud Optimized GeoTIFF and proves the conversion kept every pixel.
"""

import math
import warnings
from collections.abc import Iterator
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import rasterio
import rasterio.shutil
from rasterio.errors import NotGeoreferencedWarning, RasterioIOError
from rasterio.windows import Window

WINDOW_SIZE = 2048
MAX_REPORTED_VALUES = 10
LOSS_YEARS = range(1980, 2101)
# The analysis applies one pixel area (`pixel_size`²) to the whole layer, so the
# declared size must match the raster's cell area at every latitude it covers within
# this relative tolerance, which bounds the area (and ratio) bias. Existing layers
# differ by up to ~3.6% (ideam's projection, gfw at its northern edge).
PIXEL_AREA_RELATIVE_TOLERANCE = 0.05
# Metres per degree of longitude at the equator and of latitude.
_M_PER_DEG_LON = 111_320
_M_PER_DEG_LAT = 110_574
COG_OPTIONS = {
    "compress": "DEFLATE",
    "predictor": 2,
    "blocksize": 512,
    "overview_resampling": "nearest",
    "BIGTIFF": "IF_SAFER",
}


class IngestionError(Exception):
    """A problem with the uploaded raster, reported to the admin.

    `code` and `params` let the admin UI show it in the user's language; the English
    message is the fallback.
    """

    def __init__(self, code: str, message: str, **params):
        super().__init__(message)
        self.code = code
        self.params = params

    def as_issue(self) -> dict:
        return issue(self.code, str(self), **self.params)


def issue(code: str, message: str, **params) -> dict:
    return {"code": code, "message": message, "params": params}


# --- Validation --------------------------------------------------------------------


def _windows(width: int, height: int) -> Iterator[Window]:
    for row in range(0, height, WINDOW_SIZE):
        for col in range(0, width, WINDOW_SIZE):
            yield Window(
                col, row, min(WINDOW_SIZE, width - col), min(WINDOW_SIZE, height - row)
            )


def _distinct_values(block: np.ndarray) -> set[int]:
    if block.dtype == np.uint8:  # the usual case: much faster than np.unique
        counts = np.bincount(block.ravel(), minlength=256)
        return set(np.flatnonzero(counts).tolist())
    return {int(value) for value in np.unique(block)}


def _pixel_side_m(src, lat: float | None) -> float | None:
    """Nominal pixel side in metres from the cell area (at `lat` for a geographic
    CRS). The geometric mean keeps the area right for non-square or rotated cells."""
    try:
        cell_area = abs(
            src.transform.a * src.transform.e - src.transform.b * src.transform.d
        )
        if src.crs.is_geographic:
            assert lat is not None
            cell_area *= _M_PER_DEG_LON * math.cos(math.radians(lat)) * _M_PER_DEG_LAT
        else:
            cell_area *= src.crs.linear_units_factor[1] ** 2
        pixel_size = math.sqrt(cell_area)
        return pixel_size if math.isfinite(pixel_size) and pixel_size > 0 else None
    except Exception:  # noqa: BLE001 - unsupported CRS or transform
        return None


def raster_pixel_size_m(src) -> float | None:
    """Nominal pixel side in metres; at the middle latitude for a geographic CRS."""
    return _pixel_side_m(src, (src.bounds.top + src.bounds.bottom) / 2)


def raster_pixel_size_range_m(src) -> tuple[float, float] | None:
    """Smallest and largest nominal pixel side in metres over the raster.

    Projected CRSs have one cell area. In a geographic CRS the cell area shrinks with
    the cosine of the latitude: it is largest at the latitude closest to the equator
    and smallest at the one farthest from it.
    """
    if not src.crs.is_geographic:
        size = _pixel_side_m(src, None)
        return (size, size) if size is not None else None
    top, bottom = src.bounds.top, src.bounds.bottom
    nearest_equator = min(max(0.0, min(top, bottom)), max(top, bottom))
    farthest = max(abs(top), abs(bottom))
    smallest = _pixel_side_m(src, farthest)
    largest = _pixel_side_m(src, nearest_equator)
    if smallest is None or largest is None:
        return None
    return (smallest, largest)


def _area_difference(declared: float, measured: float) -> float:
    return abs(declared**2 - measured**2) / measured**2


def check_pixel_size(declared: float, measured: tuple[float, float] | None) -> None:
    """Reject a layer size whose pixel area differs from the raster's, anywhere in
    the raster, by more than the tolerance (it would bias the calculated areas)."""
    if measured is None:
        raise IngestionError(
            "resolution_unavailable",
            "The raster pixel size could not be determined from its CRS and transform",
        )
    smallest, largest = measured
    if max(_area_difference(declared, size) for size in measured) <= (
        PIXEL_AREA_RELATIVE_TOLERANCE
    ):
        return
    # The best single size for this raster (the geometric mean of its extremes)
    # still doesn't fit: the raster covers too wide a range of latitudes.
    best = math.sqrt(smallest * largest)
    if max(_area_difference(best, size) for size in measured) > (
        PIXEL_AREA_RELATIVE_TOLERANCE
    ):
        raise IngestionError(
            "resolution_varies",
            f"The raster's pixel size varies from {smallest:.2f} m to {largest:.2f} m "
            "across its latitudes, too much for a single layer pixel size; "
            "reproject it to an equal-area CRS or split it",
            declared=declared,
            min=round(smallest, 2),
            max=round(largest, 2),
        )
    raise IngestionError(
        "resolution_mismatch",
        f"The layer pixel size ({declared:g} m) differs from the raster "
        f"({best:.2f} m); update the layer pixel size or use another raster",
        declared=declared,
        measured=round(best, 2),
    )


def _format(value: float) -> str:
    return f"{value:g}"


@dataclass
class Validation:
    report: dict
    warnings: list[dict]
    # The nodata to store; set on the file first when it didn't declare one.
    nodata: float | None
    needs_nodata: bool
    pixel_size_range_m: tuple[float, float] | None


def validate_raster(path: Path, requested_nodata: float | None) -> Validation:
    """Structural checks plus a scan of every pixel."""
    try:
        with warnings.catch_warnings():
            # Rejected below with a clear message; no need for GDAL's warning.
            warnings.simplefilter("ignore", NotGeoreferencedWarning)
            src = rasterio.open(path)
    except RasterioIOError:
        raise IngestionError("not_geotiff", "The file is not a readable GeoTIFF")
    with src:
        if src.driver != "GTiff":
            raise IngestionError("not_geotiff", "The file is not a readable GeoTIFF")
        if src.count != 1:
            raise IngestionError(
                "band_count",
                f"The raster must have exactly one band (it has {src.count})",
                bands=src.count,
            )
        dtype = src.dtypes[0]
        if not np.issubdtype(np.dtype(dtype), np.integer):
            raise IngestionError(
                "not_integer",
                f"The raster must have integer values (it has {dtype}); "
                "use 0 for no loss and 1 for loss",
                dtype=dtype,
            )
        if src.crs is None:
            raise IngestionError(
                "no_crs", "The raster must have a coordinate reference system"
            )

        found_warnings: list[dict] = []
        declared = nodata = src.nodata
        if nodata is None:
            nodata = requested_nodata
        elif requested_nodata is not None and requested_nodata != nodata:
            found_warnings.append(
                issue(
                    "nodata_ignored",
                    f"The file already declares nodata {_format(nodata)}; "
                    f"the requested {_format(requested_nodata)} was ignored",
                    declared=nodata,
                    requested=requested_nodata,
                )
            )
        if nodata == 1:
            raise IngestionError(
                "nodata_is_loss",
                "Nodata cannot be 1 because 1 represents forest loss",
            )
        allowed = {0, 1} | ({int(nodata)} if nodata is not None else set())

        values: set[int] = set()
        for window in _windows(src.width, src.height):
            values |= _distinct_values(src.read(1, window=window))
            if len(values - allowed) >= MAX_REPORTED_VALUES:
                break  # enough to reject it

        pixel_size = raster_pixel_size_m(src)
        pixel_size_range = raster_pixel_size_range_m(src)
        report = {
            "crs": src.crs.to_string(),
            "width": src.width,
            "height": src.height,
            "bounds": [round(b, 6) for b in src.bounds],
            "dtype": dtype,
            "nodata": nodata,
            "values": sorted(values)[:20],
            "approxResolutionM": (
                round(pixel_size, 2) if pixel_size is not None else None
            ),
        }

    offending = sorted(values - allowed)[:MAX_REPORTED_VALUES]
    if offending:
        legend = "0 = no loss, 1 = loss"
        if nodata is not None:
            legend += f", {_format(nodata)} = nodata"
        message = (
            f"The raster must be binary ({legend}). Other values found: "
            f"{', '.join(str(value) for value in offending)}."
        )
        if all(value in LOSS_YEARS for value in offending):
            message += (
                " They look like loss years: binarize the layer against its "
                "baseline year before uploading."
            )
            raise IngestionError("loss_years", message, values=offending)
        if nodata is None:
            message += " If one of them marks nodata, upload again with that nodata."
        raise IngestionError("not_binary", message, values=offending, nodata=nodata)
    if 1 not in values:
        found_warnings.append(
            issue("no_loss_pixels", "No deforestation pixels (value 1) were found")
        )
    return Validation(
        report,
        found_warnings,
        nodata,
        needs_nodata=declared is None,
        pixel_size_range_m=pixel_size_range,
    )


# --- Conversion and verification ---------------------------------------------------


def set_nodata(path: Path, nodata: float) -> None:
    with rasterio.open(path, "r+") as dataset:
        dataset.nodata = nodata


def convert_to_cog(src_path: Path, dst_path: Path) -> None:
    options = dict(COG_OPTIONS)
    with rasterio.open(src_path) as src:
        nbits = src.tags(1, ns="IMAGE_STRUCTURE").get("NBITS")  # a band tag
    if nbits and int(nbits) < 8:
        # Bit-packed input (e.g. ecuador2.tif is 2-bit): the predictor needs whole
        # bytes, so store 8-bit samples. The values don't change.
        options["NBITS"] = 8
    rasterio.shutil.copy(str(src_path), str(dst_path), driver="COG", **options)


def verify_same_pixels(original: Path, converted: Path) -> None:
    with rasterio.open(original) as a, rasterio.open(converted) as b:
        same_grid = (a.width, a.height, a.crs, a.transform, a.nodata) == (
            b.width,
            b.height,
            b.crs,
            b.transform,
            b.nodata,
        )
        if not same_grid:
            raise IngestionError(
                "conversion_mismatch",
                "The converted raster doesn't match the upload's grid; nothing changed",
            )
        for window in _windows(a.width, a.height):
            if not np.array_equal(a.read(1, window=window), b.read(1, window=window)):
                raise IngestionError(
                    "conversion_mismatch",
                    "The converted raster doesn't match the upload's pixels; "
                    "nothing changed",
                )
