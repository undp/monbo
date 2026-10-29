## Polygon validation

The polygon validation module checks that each farm has a correct geometry and doesn't overlap another farm. A farm with any of the problems in this section is marked as **not valid**. You can review it on the map, fix it in your file, or include it anyway through manual validation.

This validation is a **separate, optional step**. If you upload your file directly in the deforestation analysis module, it doesn't run: the farms aren't compared with each other, so a deforestation result alone doesn't show that they don't overlap. A farm with an invalid geometry still gets no result (N/A) there.

### Accepted geometries

- **Polygons**, in WKT or GeoJSON. A polygon can have **holes** (for example, a lagoon or an area that isn't part of the farm), and it can be made of **several separate parts** (a MultiPolygon).
- **Points**, when only the farm's location is known. A point takes the area declared in the template (see [Farm area](#area)).
- Coordinates are longitude and latitude in degrees (WGS84, the system GPS uses). Longitude goes from −180 to 180, and latitude from −90 to 90. A row with coordinates outside those ranges, or with another geometry (a line, for example), is rejected when the file is uploaded.

### Invalid geometries

A polygon is invalid when it doesn't describe a well-defined area:

- **Empty polygon:** it has no points.
- **Too few points:** it has fewer than 3 distinct points, or all of them lie on one line, so it encloses no area.

  ![Polygon with too few points](/images/documentation/polygon_few_points_example.png)

- **Self-intersection:** the boundary crosses itself, like a figure eight or a bow tie. It isn't clear which part lies inside the farm.

  ![Polygon that crosses itself](/images/documentation/polygon_self_intersection_example.png)

- **Hole outside the farm:** a hole that isn't inside the outer boundary of its part.
- **Overlapping parts:** two parts of the same farm that overlap each other.

A farm with an invalid geometry isn't compared with the others to look for overlaps, and the deforestation analysis shows it with no result (N/A).

### Overlaps between farms

Two farms overlap when they share area. This happens when the same land was declared twice, or when the boundaries of two neighbouring farms were measured with errors.

![Two overlapping farms; the shared area in red](/images/documentation/polygon_overlap_example.png)

The overlap percentage is measured against the **smaller farm** of the two:

```
overlap = shared area / area of the smaller farm
```

So a 1 ha farm lying entirely inside a 200 ha farm has a 100% overlap, not 0.5%. What matters is that the whole small farm has been declared twice.

- An overlap is reported only when its percentage is **greater than {{overlapThreshold}}**. Each Monbo installation sets this threshold.
- An overlap greater than **80%** is shown in **red** (high criticality), and one of up to 80% in **orange** (medium criticality).
- Both farms of a reported overlap are marked as not valid.
- Two farms that only share an edge or a corner don't overlap, because they share no area.
- A farm lying inside another farm's hole doesn't overlap it.
- A farm with several parts is compared through all of them. Its total area is the sum of its parts.
- A farm uploaded as a point is compared as a circle built from its declared area, approximately (see [Farm area](#area)).

If a farm overlaps several others, one overlap is reported for each pair.

[Technical detail of the validation](https://github.com/undp/monbo/blob/dev/apps/api/README.md#1-polygons-validation)
