## Why

`GeometryCalculator.calculate_polygon_area` measures a farm larger than about 20 ha through an Albers equal-area projection whose standard parallels are the farm's southern and northern latitudes. When a farm crosses the equator with those latitudes exactly opposite (for example −0.008° and +0.008°), the parallels are symmetric. Albers is then undefined (`n = (sin φ1 + sin φ2) / 2 = 0`), and PROJ refuses to build it: `|lat_1 + lat_2| should be > 0`.

The error isn't caught where the area is used:

- **`POST /farms/parse`** answers 400 for the whole file, so one such farm blocks the upload of all the others. The message is PROJ's, in English.
- **`POST /polygons_validation/validate`** fails with a 500. Neither farm has to be symmetric: the intersection of two farms is enough.
- **`POST /deforestation_analysis/analize`** gives the farm no ratio (N/A) on every layer.

It takes a farm of more than ~20 ha whose latitudes are opposite to within about a millimetre. GPS coordinates almost never are, but rounded or hand-drawn ones can be (a rectangle from −0.0150 to 0.0150). Ecuador and Colombia, both Monbo countries, straddle the equator.

The projection only exists to approximate an area that `pyproj` can compute exactly on the WGS84 ellipsoid. Today it takes three strategies (a global Albers, a local Albers, and a "precision check" comparing the two that only logs), chosen by latitude and size thresholds. On farms, the two agree to within 0.001% (most of them to the square centimetre).

## What Changes

- A farm's area (and an overlap's) is the **geodesic area on the WGS84 ellipsoid** (`pyproj.Geod.geometry_area_perimeter`). It has no projection to choose and nothing that can be degenerate. Holes are subtracted and the parts of a MultiPolygon added, whatever the orientation of the input rings.
- The local and global Albers projections, the precision check and their thresholds are removed.
- An invalid polygon still has an area of −1 and an empty one 0, as today, so the validation and the analysis keep treating them the same way.
- Existing farms keep their area in practice:
  - the numeric baseline passes unchanged;
  - the regression suite's areas move by at most 2 cm², on 2 of its farms, with their ratios and overlaps unchanged;
  - over about 1,000 random polygons (0.1 to 1,000 ha, latitudes −60° to 60°, with and without holes), the largest difference is 0.91 m² (0.0007%).

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities
- `farm-geometry`: adds that a farm's area is measured on the ellipsoid and never fails because of where the farm is.

## Impact

- **API:** `app/helpers/GeometryCalculator.py` (`calculate_polygon_area` and the methods and constants it no longer needs). Its callers (`app/utils/farms.py`, the validation helpers, the analysis router) don't change. No contract change.
- **Tests:** a new `tests/helpers/test_geometry_calculator.py`, plus endpoint tests for a farm symmetric about the equator in `/farms/parse`, `/validate` and `/analize`. The analysis test that avoided a symmetric square (from `support-holes-and-multipolygons`) goes back to one.
- **Docs:** `docs/deforestation_calculation.md` says how the area is measured. The CHANGELOG gets a "Fixed" entry.
- **Users:** the farms that failed now upload, validate and get a ratio. The others see no change.
