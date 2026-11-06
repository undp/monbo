# Regenerates src/utils/countryBounds.json: each country's bounding box as
# [west, south, east, north] in degrees, keyed by ISO 3166-1 alpha-2 code. The
# manual farm modal opens its map on the selected country's box.
#
# The source is Natural Earth's admin-0 countries at 1:50m (public domain). The
# boxes only change if it does, so the app ships the JSON. To regenerate (from the
# repo root), with the API's environment, which has geopandas:
#
#   uv run --directory apps/api python -I ../web/scripts/generate-country-bounds.py
#
# - Small islands far from the mainland (under 5% of the country's largest polygon
#   and more than 3° from it, e.g. the Galápagos or Easter Island) are dropped, so the
#   map opens on the land where the farms are.
# - The antimeridian: a country's parts on its other side are usually dropped by the
#   rule above, so Russia and Fiji end at 180°. One that still spans it (Kiribati)
#   gets the narrower box across it, with its west greater than its east, as Google
#   Maps' LatLngBounds takes it.
# - Values are rounded outwards to 2 decimals.

import json
import math
import tempfile
import urllib.request
import warnings
from pathlib import Path

import geopandas
from shapely.geometry import MultiPolygon, Polygon, box

SOURCE_URL = (
    "https://naciscdn.org/naturalearth/50m/cultural/ne_50m_admin_0_countries.zip"
)
MIN_ISLAND_SHARE = 0.05
MAX_ISLAND_DISTANCE = 3  # degrees from the largest polygon's box
TARGET = Path(__file__).resolve().parent.parent / "src/utils/countryBounds.json"


def parts(geometry) -> list[Polygon]:
    if isinstance(geometry, MultiPolygon):
        return list(geometry.geoms)
    return [geometry]


def kept_parts(geometry) -> list[Polygon]:
    polygons = parts(geometry)
    largest = max(polygons, key=lambda polygon: polygon.area)
    largest_box = box(*largest.bounds).buffer(MAX_ISLAND_DISTANCE)
    return [
        polygon
        for polygon in polygons
        if polygon.area >= largest.area * MIN_ISLAND_SHARE
        or polygon.intersects(largest_box)
    ]


def bounds(polygons: list[Polygon]) -> list[float]:
    south = min(polygon.bounds[1] for polygon in polygons)
    north = max(polygon.bounds[3] for polygon in polygons)
    west = min(polygon.bounds[0] for polygon in polygons)
    east = max(polygon.bounds[2] for polygon in polygons)

    # The same box with the western parts moved east by 360°: narrower for a
    # country across the antimeridian, whose parts sit at both ends of [-180, 180].
    def shifted(polygon: Polygon) -> tuple[float, float]:
        west, _, east, _ = polygon.bounds
        return (west + 360, east + 360) if east < 0 else (west, east)

    shifted_west = min(shifted(polygon)[0] for polygon in polygons)
    shifted_east = max(shifted(polygon)[1] for polygon in polygons)
    if shifted_east - shifted_west < east - west:
        west = shifted_west - 360 if shifted_west > 180 else shifted_west
        east = shifted_east - 360 if shifted_east > 180 else shifted_east

    return [
        math.floor(west * 100) / 100,
        math.floor(south * 100) / 100,
        math.ceil(east * 100) / 100,
        math.ceil(north * 100) / 100,
    ]


def main() -> None:
    with tempfile.TemporaryDirectory() as directory:
        archive = Path(directory) / "countries.zip"
        request = urllib.request.Request(
            SOURCE_URL, headers={"User-Agent": "monbo-country-bounds"}
        )
        with urllib.request.urlopen(request) as response:
            archive.write_bytes(response.read())
        countries = geopandas.read_file(archive, columns=["ISO_A2_EH"])

    countries = countries[countries["ISO_A2_EH"].str.fullmatch(r"[A-Z]{2}")]
    # A code listed twice (Australia and its territories) keeps the larger. Areas in
    # square degrees: only compared, so the projection doesn't matter.
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", UserWarning)
        areas = countries.geometry.area
    countries = countries.assign(area=areas).sort_values("area", ascending=False)
    countries = countries.drop_duplicates("ISO_A2_EH")

    result = {
        row.ISO_A2_EH: bounds(kept_parts(row.geometry))
        for row in countries.itertuples()
        if row.geometry is not None and not row.geometry.is_empty
    }
    TARGET.write_text(
        json.dumps(dict(sorted(result.items())), separators=(",", ":")) + "\n"
    )
    print(f"Wrote {len(result)} country boxes to {TARGET}")


if __name__ == "__main__":
    main()
