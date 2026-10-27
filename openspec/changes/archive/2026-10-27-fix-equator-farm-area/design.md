## Context

`calculate_polygon_area` picks one of three ways to measure an area:

| Farm | Method |
|---|---|
| side < ~500 m, latitude ≤ 30° | Albers with fixed parallels at 30° and 60° (`GLOBAL_TRANSFORMER`) |
| side ≥ ~500 m | The same, plus `_check_area_accuracy`, which rebuilds a local Albers with parallels at the farm's latitudes and only logs a warning |
| side ≥ ~700 m, or latitude > 30° | Local Albers, parallels at the farm's latitudes (`_calculate_area_with_local_projection`) |

The local Albers is undefined when its parallels are symmetric about the equator, and PROJ raises `CRSError`. `_calculate_area_with_local_projection` already guards against equal parallels, but not against opposite ones; `_check_area_accuracy` guards against neither. The exception escapes to:

- `parse_base_information`, which turns it into a 400 for the whole file;
- the overlap check, where nothing catches it (a 500);
- the analysis loop, which turns it into `None`.

All three methods approximate the area of the polygon on the ellipsoid. Albers is equal-area for any choice of parallels, which is why the global one already agrees with the geodesic area at farm scale.

## Goals / Non-Goals

**Goals:**
- No farm's area fails because of its location.
- One exact method instead of three approximations and their thresholds.
- Existing areas unchanged in practice: within 0.001% of the previous method, most of them to the cm².

**Non-Goals:**
- Catching geometry errors at the callers. With no projection left, there is nothing location-dependent to fail.
- Changing how an invalid polygon is signalled (−1). The validation and the analysis rely on it.
- `calculate_geometry_center` and the image helpers, which don't measure areas.

## Decisions

### Geodesic area with `pyproj.Geod`

```python
GEOD: Final[Geod] = Geod(ellps="WGS84")

def calculate_polygon_area(polygon):
    if not polygon.is_valid:
        return -1
    if polygon.is_empty:
        return 0
    area, _ = GEOD.geometry_area_perimeter(oriented(polygon))
    return round(abs(area), 2)
```

`geometry_area_perimeter` adds each ring's signed area: positive for counter-clockwise rings, negative for clockwise ones. It handles Polygons with interiors and MultiPolygons.

- *Alternative: keep Albers and shift symmetric parallels* (for example 1° north, which doesn't change an equal-area result). Rejected. It fixes the crash, but keeps three methods, their thresholds and a precision check that can still fail a request.
- *Alternative: a Lambert azimuthal equal-area projection centred on the farm.* It has no degenerate case, but it is still an approximation with a projection to build per farm. The geodesic area is the quantity the projections approximate.

### Orient before measuring

A hole is only subtracted when it winds opposite to its exterior. Farms from `/farms/parse` are already oriented, but areas are also measured on the input geometry and on Shapely intersections. So every part is oriented with `shapely.geometry.polygon.orient(part, sign=1.0)` first, and `abs()` guards the sign.

### Remove the unused methods

`_calculate_area_with_local_projection`, `_calculate_area_with_global_projection`, `_check_area_accuracy` and the constants they use go. `_lon_span` goes too if nothing else uses it. A grep confirms nothing outside the class uses them before they are deleted.

## Risks / Trade-offs

- **[Areas shift in the last decimal, so baselines fail]** → The regression and numeric baseline suites must pass unchanged. A one-off comparison over about 1,000 random polygons reports the largest difference in the PR. If any baseline moves, stop and report it rather than regenerate it.
- **[Speed]** `geometry_area_perimeter` is C code, one call per polygon. It is not slower than building a transformer and projecting, which the local method did per farm. The comparison script times both.
- **[Very large or polar polygons]** Geodesic area is exact there, where the projections were the weak point. Farms are far from that scale anyway.

## Migration Plan

API only, with no contract change: deploy as usual. Rollback is a revert.

## Open Questions

None.
