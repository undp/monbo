## Polygon validation

:::summary
- It checks that each farm has a correct geometry and doesn't overlap another farm.
- A farm with any problem is marked **not valid**: you can fix it, or include it anyway through manual validation.
- It is an **optional** step: a deforestation result doesn't show that the farms don't overlap.
:::

If you upload the farms directly in the deforestation analysis, overlaps aren't looked for. The accepted geometries are in [Farm upload](#upload).

### Why is my farm not valid?

Because its geometry is invalid, or because it overlaps another farm. The invalid geometries are:

- **Empty:** it has no points.
- **Too few points:** fewer than 3 distinct points, or all of them on one line.

  ![Polygon with too few points](/images/documentation/polygon_few_points_example.png)

- **Self-intersection:** the boundary crosses itself, like a figure eight.

  ![Self-intersecting polygon](/images/documentation/polygon_self_intersection_example.png)

- **Hole outside the farm:** a hole that isn't inside the boundary of its part.
- **Overlapping parts:** two parts of the same farm that overlap each other.

### How is an overlap measured?

Two farms overlap when they share area: land declared twice, or boundaries measured with errors.

![Two overlapping farms; the shared area in red](/images/documentation/polygon_overlap_example.png)

The percentage is measured against the **smaller farm**:

```
overlap = shared area / area of the smaller farm
```

A 1 ha farm lying entirely inside a 200 ha farm has a 100% overlap, not 0.5%: the whole small farm has been declared twice.

- An overlap is reported only when it is **greater than {{overlapThreshold}}**. Each Monbo deployment sets this threshold.
- Above **80%** it is shown in **red** (high criticality); up to 80%, in **orange** (medium criticality).
- Both farms of a reported overlap are marked not valid.

:::details[More detail: edges, holes, several parts and points]
- A farm with an invalid geometry isn't compared with the others, and the deforestation analysis shows it with no result (N/A).
- Two farms that only share an edge or a corner don't overlap: they share no area.
- A farm inside another farm's hole doesn't overlap it.
- A farm with several parts is compared through all of them. Its area is the sum of its parts.
- A point is compared as a circle built from its declared area, approximately (see [Farm area](#area)).
- If a farm overlaps several others, one overlap is reported for each pair.
:::

[Technical detail of the validation](https://github.com/undp/monbo/blob/dev/apps/api/README.md#1-polygons-validation)
