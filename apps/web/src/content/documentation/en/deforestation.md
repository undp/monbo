## Deforestation calculation

For each farm and each selected map layer, Monbo calculates **what percentage of the farm's area lies on places where forest was lost**.

### Map layers

A map layer divides the land into a grid of **pixels**: 30 × 30 m squares in most layers (10 × 10 m in some, such as Costa Rica's). The layer marks each pixel where forest was lost between its baseline year and its comparison year. The source, resolution and dates of each layer are in **Map details**, in the deforestation analysis module.

### The percentage

```
deforestation = farm area on pixels with loss / farm area
```

Each pixel with loss **counts only by the part of it inside the farm**. If the farm's boundary covers a third of a pixel with loss, that pixel adds a third of its area, not the whole pixel. So the percentage never exceeds 100%, and a pixel the farm barely touches at its edge doesn't make it look deforested.

Both areas are measured on the layer itself, in its own coordinates, not with the area in hectares shown in the tables. At a farm's size, the ratio between them is the same as on the ground.

If the farm has holes, loss inside a hole doesn't count. If it has several parts, the loss in all of them is added up and divided by their total area (see [Farm area](#area)). Each farm gets a single percentage per layer.

### An example

A 1 ha farm (10,000 m²), on a layer with 30 m pixels (900 m² each):

- it fully covers 2 pixels with loss: 2 × 900 = 1,800 m²;
- its boundary crosses a third pixel with loss and leaves 300 m² of it inside the farm.

```
deforestation = (1,800 + 300) / 10,000 = 21%
```

### The threshold

A farm whose percentage is **greater than {{deforestationThreshold}}** is shown with deforestation on that layer. If its percentage is equal or lower, it is shown as **deforestation free**. Each Monbo installation sets this threshold.

### Farms with no result

A farm shows **no result (N/A)** on a layer, instead of 0%, when it can't be measured:

- its polygon is invalid or empty (see [Polygon validation](#validation));
- its area is 0;
- it lies entirely outside the area the layer covers;
- the layer couldn't be read at the time.

A farm with no result doesn't affect the other farms' results.

On the analysis map, for now, a farm with no result is listed in the **Def. Free** tab, with N/A instead of a percentage. It hasn't been measured: it is not a deforestation-free result.

### The limit of the method

The precision stops at the pixel. When a layer marks a pixel with loss, the whole pixel is taken as lost forest. The calculation splits each pixel exactly between the farm and its surroundings, but it can't know where in the pixel the loss happened. That precision depends on each layer's resolution, not on the calculation.

Each layer also uses its own definition of forest and its own dates. That is why the same farm can have different percentages on different layers.

[Technical detail of the deforestation calculation](https://github.com/undp/monbo/blob/dev/docs/deforestation_calculation.md)
