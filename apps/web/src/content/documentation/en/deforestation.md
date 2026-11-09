## Deforestation calculation

:::summary
- For each farm and map layer, Monbo calculates **what percentage of the farm lies on places with forest loss**.
- A pixel the farm only partly covers counts only by that part.
- A farm **above {{deforestationThreshold}}** is shown with deforestation on that layer.
:::

### What is a map layer?

A grid of **pixels** of 30 × 30 m (10 × 10 m in some layers) that marks where forest was lost between two years. Their sources and dates are in **Map details**.

### How is the percentage calculated?

```
deforestation = farm area on pixels with loss / farm area
```

Each pixel with loss **counts only by the part of it inside the farm**. So a pixel the farm barely touches doesn't make it look deforested.

For example, a 1 ha farm (10,000 m²) on 30 m pixels (900 m²) fully covers 2 pixels with loss, and its boundary leaves 300 m² of a third one inside:

![A 900 m² pixel with loss cut by the farm's boundary: 300 m² lie inside the farm](/images/documentation/loss_pixel_partial.svg)

```
deforestation = (2 × 900 + 300) / 10,000 = 21%
```

Above {{deforestationThreshold}}, the farm is shown with deforestation on that layer; at {{deforestationThreshold}} or less, as **deforestation-free**.

### How is each area measured?

Each piece of a pixel inside the farm, and the farm itself, is a polygon given by its corners. Its area is calculated with **Gauss's area formula** (or shoelace formula):

```
A = ½ · | Σ (xᵢ · yᵢ₊₁ − xᵢ₊₁ · yᵢ) |
```

The corners are taken in order. Each edge forms a triangle with the origin (0, 0), which adds when the edge goes one way and subtracts when it comes back the other way. What lies outside the polygon is added and subtracted, so it cancels out: only the area inside remains. That is why it works for any shape, like the irregular piece of a cut pixel.

![The 300 m² piece split into the triangles its edges form with the origin: 75 m² and 225 m²](/images/documentation/gauss_area_formula.svg)

### Why does N/A appear?

A farm gets **no result (N/A)**, instead of 0%, when it can't be measured:

- its polygon is invalid or empty (see [Polygon validation](#validation));
- its area is 0;
- it lies entirely outside the area the layer covers;
- the layer couldn't be read at that moment.

On the analysis map it is listed, for now, in the **Def. Free** tab with N/A. It is not a deforestation-free result: it couldn't be measured.

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

The two edges through the origin form no triangle and add 0. The other two give the triangles in the drawing: ½ · 150 = 75 m² and ½ · 450 = 225 m². The farm's area is calculated the same way, with all its corners.
:::

:::details[More detail: the limit of the method]
The precision stops at the pixel. If a layer marks a pixel with loss, the whole pixel counts as lost forest: the calculation splits each pixel exactly between the farm and its surroundings, but it can't know where in the pixel the loss happened. That precision depends on each layer's resolution, not on the calculation.

Each layer also has its own definition of forest and its own dates, so the same farm can have different percentages on different layers.
:::

:::details[More detail: holes, several parts and the layer's coordinates]
- If the farm has holes, loss inside a hole doesn't count. If it has several parts, the loss in all of them is added up and divided by their total area. Each farm gets a single percentage per layer.
- A farm with no result doesn't affect the others' results.
- Both areas are measured on the layer itself, in its own coordinates, not with the hectares shown in the tables (see [Farm area](#area)). Some layers are in metres and others in degrees of latitude and longitude. In degrees, a degree of longitude covers less ground away from the equator, but at a farm's size that distortion affects both areas of the percentage equally, so it cancels out in the division. The ratio is the same as on the ground.
:::

[Technical detail of the deforestation calculation](https://github.com/undp/monbo/blob/dev/docs/deforestation_calculation.md)
