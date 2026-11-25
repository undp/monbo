## Farm area

:::summary
- A polygon's area is **calculated** from its coordinates, on the Earth's real shape.
- A point uses its **declared area**.
- It is the area in hectares shown in the tables and the report, and overlaps are measured with it.
:::

### How is a polygon's area calculated?

From its coordinates, not from the declared area. It is measured on the **Earth's ellipsoid** (WGS84, the GPS model of the Earth), without a flat map, which would distort areas depending on the region. The calculation adds, for each edge of the boundary, the area between that edge and the equator: the same idea as Gauss's area formula (see [Deforestation calculation](#deforestation)), on the curved Earth.

**Holes are subtracted** and **parts are added**: a 10 ha farm with a 1 ha lagoon measures 9 ha.

### And a point's area?

It uses the **declared area** (see [Farm upload](#upload)). For overlaps and deforestation it is treated as a **circle** with that area: a 1 ha point gets a radius of about 56 m.

:::details[More detail: invalid polygons, a point's circle and the deforestation percentage]
- An invalid polygon (see [Polygon validation](#validation)) has no area, so it gets no deforestation percentage.
- The tables and the report show the point's declared area, not the circle's.
- The order in which the boundary's points were written (clockwise or counter-clockwise) doesn't change the result.
- A point's circle is an **approximation** of the declared area. It is drawn in degrees of latitude and longitude, and a degree of longitude covers less ground the farther from the equator. So the circle is narrower from east to west and covers somewhat less ground than declared: 1.5% less at 10° of latitude and 13% less at 30°.
- The deforestation percentage doesn't divide by this area. It compares two areas measured on the map layer itself (see [Deforestation calculation](#deforestation)). This area only decides whether the farm can be analysed.
:::

[Technical detail of the area calculation](https://github.com/undp/monbo/blob/dev/docs/polygon_area_calculation.md)
