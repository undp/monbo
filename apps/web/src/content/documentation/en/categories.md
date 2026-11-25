## Layer categories

:::summary
- Each country groups its layers into **categories**, such as Deforestation, Protected areas or Agricultural frontier.
- The category says what counts as a **finding**: coinciding with the layer or falling outside it.
- A farm has findings when it is above its category's **threshold**.
:::

Each category has a name, icon, color, threshold and the texts of its two results, and marks one of two things:

- **What to avoid** (forest loss, protected areas): the finding is the percentage of the farm that coincides with the layer.
- **What is allowed** (agricultural frontier): the finding is what falls outside, 100% minus the percentage that coincides.

### When does a farm have findings?

When its finding is above the category's threshold. Otherwise it is **without findings**, with the category's result text, such as "Deforestation-free". A category without its own threshold uses the general one, {{deforestationThreshold}}. A farm with **no data** (N/A) is neither with nor without findings (see [How we calculate](#calculation)).

Each country's categories and thresholds are in [Layers by country](#layers).

:::details[More detail: the same farm in both kinds of category]
A farm coincides 30% with a layer, and the category's threshold is 0%:

```
what to avoid:     finding = 30%              → with findings
what is allowed:   finding = 100% − 30% = 70% → with findings
```

If the farm coincided 100%, it would have a 100% finding in the first and 0% in the second: it would be without findings only in the second.
:::
