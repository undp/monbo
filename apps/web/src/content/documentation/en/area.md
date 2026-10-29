## Farm area

Each farm's area is used throughout the app. It is the area in hectares you see in the tables and the report. It is also used to calculate overlaps and the deforestation percentage.

### Polygons

Monbo **calculates** each polygon's area from its coordinates. The area declared in the template isn't used for polygons.

- The area is measured on the **Earth's ellipsoid** (WGS84, the model of the Earth GPS uses), with no map projection. A flat map distorts areas depending on the region, while the ellipsoid gives the land's true area anywhere, even for a farm that crosses the equator.
- **Holes are subtracted.** A 10 ha farm with a 1 ha lagoon inside it measures 9 ha.
- **Parts are added.** A farm with two separate parts, of 9 ha and 5 ha, measures 14 ha.
- The order in which the points were written (clockwise or counter-clockwise) doesn't change the result.

An invalid polygon (see [Polygon validation](#validation)) has no well-defined area. That is why it gets no deforestation percentage.

### Points

A farm uploaded as a point has no boundary, so Monbo uses the **area declared** in the template, in hectares. If the template doesn't give one, **1 ha** is assumed.

To look for overlaps and to measure deforestation, the point is treated as a **circle** centred on that location, with that area. For example, a 1 ha point is analysed as a circle with a radius of about 56 m.

[Technical detail of the area calculation](https://github.com/undp/monbo/blob/dev/docs/polygon_area_calculation.md)
