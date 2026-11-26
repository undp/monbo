## MODIFIED Requirements

### Requirement: Each layer's rule comes from its category

In the stage 2 views (results table, per-layer counter, summary per category, map groups, map
popup, farm list), in the PDF report and in the exports, the web SHALL classify a layer's
results with the rule of the layer's category: its polarity and its `thresholdPercentage` from
`GET /categories`. When the layer's `categoryId` is not among the country's categories, every
result of that layer SHALL be `unknown`; the web SHALL NOT fall back to another rule. How the
report and the exports write each class is in `category-report` and `results-export`.

#### Scenario: Required category

- **WHEN** a layer's category is `required` with a threshold of 5, and a result is `0.9`
- **THEN** the result is `flagged` in every stage 2 view, the PDF report and the exports

#### Scenario: Category threshold

- **WHEN** a layer's category is `avoid` with a threshold of 10, the global deforestation
  threshold is 2, and a result is `0.05`
- **THEN** the result is `ok` in every stage 2 view, the PDF report and the exports

#### Scenario: Category no longer listed

- **WHEN** an analysed layer's category is disabled after the analysis, so it is no longer in
  `GET /categories`
- **THEN** every result of that layer shows "Sin dato" and none counts as `ok` or `flagged`

## REMOVED Requirements

### Requirement: The default rule until categories are wired

**Reason**: The PDF report and the exports were moved to categories (`category-report`); no
view classifies with a fixed `avoid` polarity and the global threshold any more.
**Migration**: None in code. The global `DEFORESTATION_THRESHOLD_PERCENTAGE` still applies, as
the threshold of a category that has none of its own (`layer-categories`, "Public list of a
country's categories").
