## How we calculate

:::summary
- Each polygon is crossed with each layer. The result is **what percentage of its area coincides with the layer**.
- A pixel the polygon only partly covers counts only by that part.
- The layer's category says whether that percentage is a finding (see [Layer categories](#categories)).
:::

### What is a layer?

A grid of **pixels**, for example of 30 × 30 m, in which each pixel marks or doesn't mark what the layer represents: forest loss, a protected area or the agricultural frontier. Each country's layers, with their sources, dates and resolution, are in [Layers by country](#layers).

### How is the percentage calculated?

```
% of the polygon = area that coincides with the layer / total area of the polygon × 100
```

Each marked pixel **counts only by the part of it inside the polygon**.

For example, on a deforestation layer, a 1 ha farm (10,000 m²) on 30 m pixels (900 m²) fully covers 2 pixels with loss, and its boundary leaves 300 m² of a third one inside:

![A 900 m² pixel with loss cut by the farm's boundary: 300 m² lie inside the farm](/images/documentation/loss_pixel_partial.svg)

```
% of the farm = (2 × 900 + 300) / 10,000 × 100 = 21%
```

In a category such as Deforestation, a farm above its category's threshold is shown with deforestation on that layer; at the threshold or less, as **deforestation-free**. Each category's threshold is in [Layers by country](#layers); a category without its own uses the general one, {{deforestationThreshold}}.

### How is each area measured?

Each piece of a pixel inside the polygon, and the polygon itself, is a polygon given by its corners. Its area is calculated with **Gauss's area formula** (or shoelace formula):

```
A = ½ · | Σ (xᵢ · yᵢ₊₁ − xᵢ₊₁ · yᵢ) |
```

The corners are taken in order. Each edge forms a triangle with the origin (0, 0), which adds when the edge goes one way and subtracts when it comes back the other way. What lies outside the polygon is added and subtracted, so it cancels out: only the area inside remains. That is why it works for any shape, like the irregular piece of a cut pixel.

![The 300 m² piece split into the triangles its edges form with the origin: 75 m² and 225 m²](/images/documentation/gauss_area_formula.svg)

### Why does N/A appear?

A farm gets **no data (N/A)**, instead of 0%, when it can't be measured:

- its polygon is invalid or empty (see [Polygon validation](#validation));
- its area is 0;
- it lies entirely outside the area the layer covers;
- the layer couldn't be read at that moment.

On the analysis map it is listed in its own tab, **No data**, with N/A, and the counter of farms without findings leaves it out. It is not a result without findings: it couldn't be measured.

:::details[More detail: Gauss's formula step by step]
The 300 m² piece of the example has its corners at (0, 0), (30, 0), (30, 5) and (0, 15), in metres. Each edge adds one term:

```
edge                xᵢ · yᵢ₊₁ − xᵢ₊₁ · yᵢ
(0, 0)  → (30, 0)    0 · 0  − 30 · 0  =   0
(30, 0) → (30, 5)   30 · 5  − 30 · 0  = 150
(30, 5) → (0, 15)   30 · 15 −  0 · 5  = 450
(0, 15) → (0, 0)     0 · 0  −  0 · 15 =   0
                                  sum = 600

A = ½ · 600 = 300 m²
```

The two edges through the origin form no triangle and add 0. The other two give the triangles in the drawing: ½ · 150 = 75 m² and ½ · 450 = 225 m². The farm's area is calculated the same way, one closed outline at a time: the formula gives the area of each part's outer boundary and of each hole, the holes are subtracted from their part and the parts are added up. A 10 ha farm with a 1 ha hole measures 9 ha.
:::

:::details[More detail: the limit of the method]
The precision stops at the pixel. If a layer marks a pixel, the whole pixel counts as marked: the calculation splits each pixel exactly between the farm and its surroundings, but it can't know where in the pixel, for example, the forest loss is. That precision depends on each layer's resolution, not on the calculation.

Each layer also has its own definitions and dates, so the same farm can have different percentages on different layers. Each layer's scope is in [Scope and limits](#limits).
:::

:::details[More detail: holes, several parts and the layer's coordinates]
- If the farm has holes, what the layer marks inside a hole doesn't count. If it has several parts, what coincides in all of them is added up and divided by their total area. Each farm gets a single percentage per layer.
- A farm with no result doesn't affect the others' results.
- Both areas are measured on the layer itself, in its own coordinates, not with the hectares shown in the tables (see [Farm area](#area)). Some layers are in metres and others in degrees of latitude and longitude. In degrees, a degree of longitude covers less ground away from the equator, but at a farm's size that distortion affects both areas of the percentage equally, so it cancels out in the division. The ratio is the same as on the ground.
:::

[Technical detail of the calculation](https://github.com/undp/monbo/blob/dev/docs/deforestation_calculation.md)
