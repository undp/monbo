## ADDED Requirements

### Requirement: Each layer's rule comes from its category

In the stage 2 views (results table, per-layer counter, summary per category, map groups, map
popup, farm list), the web SHALL classify a layer's results with the rule of the layer's category:
its polarity and its `thresholdPercentage` from `GET /categories`. When the layer's `categoryId`
is not among the country's categories, every result of that layer SHALL be `unknown`; the web
SHALL NOT fall back to another rule. The PDF report and the exports keep the default rule until
they are moved to categories.

#### Scenario: Required category

- **WHEN** a layer's category is `required` with a threshold of 5, and a result is `0.9`
- **THEN** the result is `flagged` in every stage 2 view

#### Scenario: Category threshold

- **WHEN** a layer's category is `avoid` with a threshold of 10, the global deforestation
  threshold is 2, and a result is `0.05`
- **THEN** the result is `ok` in every stage 2 view

#### Scenario: Category no longer listed

- **WHEN** an analysed layer's category is disabled after the analysis, so it is no longer in
  `GET /categories`
- **THEN** every result of that layer shows "Sin dato" and none counts as `ok` or `flagged`

## MODIFIED Requirements

### Requirement: The default rule until categories are wired

Until the PDF report and the exports are moved to categories, they SHALL classify every layer
result with polarity `avoid` and the deforestation threshold published at `GET /config`. The
stage 2 views SHALL NOT use this rule: they use the rule of each layer's category.

#### Scenario: Threshold from the API

- **WHEN** `GET /config` publishes a deforestation threshold of 2
- **THEN** a result of `0.02` is `ok` and a result of `0.021` is `flagged` in the PDF and the
  exports
