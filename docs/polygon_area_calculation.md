# How a farm's area is calculated

A farm's area is the one the web shows (in hectares) and the one overlaps are measured against. For a polygon it is computed from its coordinates. For a point it is the area declared in the upload template.

The user-facing explanation is the web's documentation page (`/documentation#area`). Its text is in `apps/web/src/content/documentation/{es,en}/area.md`: update it whenever this calculation changes.

## Polygons

`GeometryCalculator.calculate_polygon_area` (`apps/api/app/helpers/GeometryCalculator.py`) measures the polygon's **geodesic area on the WGS84 ellipsoid** with `pyproj.Geod.geometry_area_perimeter`, in square metres rounded to 2 decimals. It uses no map projection.

1. **Orient the rings.** pyproj adds each ring's signed area, positive when it winds counter-clockwise. So each part is oriented with `shapely.geometry.polygon.orient(part, sign=1.0)`: exterior counter-clockwise, holes clockwise. The area doesn't depend on how the input rings were written.
2. **Add the parts, subtract the holes.** Every part goes into one `MultiPolygon`. With the rings oriented, pyproj's sum is the parts' area minus their holes'.
3. **Special values.**
   - An invalid polygon (self-intersection, fewer than 3 distinct vertices, a hole outside its exterior, parts that overlap) gets **−1**.
   - So does one whose area isn't a finite number, such as a polygon beyond the poles.
   - An empty polygon gets **0**.

   The polygon validation and the deforestation analysis rely on these values. A farm with an area of −1 or 0 gets no deforestation ratio (`null`).

`POST /farms/parse` computes it for each polygon farm (`apps/api/app/utils/farms.py`). The area column of the template is ignored for polygons.

### Example

A farm with a 10 ha exterior, a 1 ha hole and a second 5 ha part measures 14 ha. The same farm with a clockwise exterior and a counter-clockwise hole gets the same, positive area.

### Why the ellipsoid

The area used to come from Albers equal-area projections, chosen by the farm's size and latitude. On farms they agree with the geodesic area to within 0.001%, most of them to the square centimetre. But Albers is undefined when its two standard parallels are opposite about the equator (`n = (sin φ1 + sin φ2) / 2 = 0`), so a farm of more than about 20 ha whose latitudes were symmetric about it couldn't be measured. Ecuador and Colombia straddle the equator. The geodesic area has no projection to choose and nothing that can be degenerate. The details are in the archived OpenSpec change `openspec/changes/archive/2026-10-27-fix-equator-farm-area/`.

## Overlaps

An overlap's area is the geodesic area, by the same function, of the polygonal part of the two farms' intersection. Shared edges and vertices have no area and make no overlap. The overlap's percentage divides it by the smaller farm's area (`get_overlap_ratio`, `apps/api/app/modules/polygons_validation/helpers.py`).

## Points

A farm given as a point has no boundary. Its area is the **area declared** in the template, in hectares. If the template leaves it blank, it is `FarmDefaults.DEFAULT_POINT_AREA_HECTARES` (1 ha, `apps/api/app/config/constants.py`).

`get_point_area_and_radius` (`apps/api/app/utils/polygons.py`) turns the area into a radius, `r = √(A / π)`. A 1 ha point has a radius of 56.42 m. For overlaps and for the deforestation analysis, the point is the circle of that radius around it (`generate_polygon`):

- The circle is built in degrees: the radius is converted with the length of a degree of latitude.
- A degree of longitude is shorter by cos(latitude), so the circle is slightly narrower east-west on the ground.
- It narrows by 1 − cos(latitude): 1.5% at 10°, the latitude of Costa Rica, and 13% at 30°.

The area shown for the point is the declared one, not the circle's.
