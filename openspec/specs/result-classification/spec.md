# result-classification Specification

## Purpose
TBD - created by archiving change single-result-classification. Update Purpose after archive.
## Requirements
### Requirement: One classification of a layer result

The web SHALL classify a farm's result for a layer as `ok`, `flagged` or `unknown` with one function, from the result's `value` and a rule made of a polarity (`avoid` or `required`) and a threshold in percent. The finding SHALL be `value` for `avoid` and `1 − value` for `required`. A result SHALL be `flagged` when 100 × finding is strictly greater than the threshold, and `ok` otherwise. A finding SHALL count as above the threshold only when it exceeds it by more than floating-point rounding error, so a result exactly on the threshold is never flagged, whatever the size of the threshold. A `value` of `null`, or a farm with no result for that layer, SHALL be `unknown`, whatever the rule.

#### Scenario: Avoid polarity above the threshold

- **WHEN** a result of `0.05` is classified with polarity `avoid` and a threshold of 2
- **THEN** it is `flagged`

#### Scenario: Avoid polarity below the threshold

- **WHEN** a result of `0.005` is classified with polarity `avoid` and a threshold of 2
- **THEN** it is `ok`

#### Scenario: Required polarity

- **WHEN** a result of `0.9` is classified with polarity `required` and a threshold of 5
- **THEN** its finding is `0.1` and it is `flagged`
- **AND** a result of `1` with the same rule is `ok`

#### Scenario: A value exactly on the threshold

- **WHEN** a result of `0.07` is classified with polarity `avoid` and a threshold of 7, or a result of `0.58` with polarity `required` and a threshold of 42
- **THEN** both are `ok`, although `100 × 0.07` and `100 × (1 − 0.58)` are a hair above the threshold in floating point

#### Scenario: A tiny threshold

- **WHEN** the threshold is 0.0000001 and polarity is `avoid`
- **THEN** a result of `0.000000001` is `ok` and a result of `0.0000000015` is `flagged`

#### Scenario: Threshold of zero

- **WHEN** the threshold is 0 and polarity is `avoid`
- **THEN** a result of `0` is `ok` and a result of `0.000001` is `flagged`

#### Scenario: No data

- **WHEN** a result's `value` is `null`, or the farm has no result for the layer
- **THEN** it is `unknown` for both polarities and any threshold

### Requirement: The default rule until categories are wired

Until the PDF report and the exports are moved to categories, they SHALL classify every layer
result with polarity `avoid` and the deforestation threshold published at `GET /config`. The
stage 2 views SHALL NOT use this rule: they use the rule of each layer's category.

#### Scenario: Threshold from the API

- **WHEN** `GET /config` publishes a deforestation threshold of 2
- **THEN** a result of `0.02` is `ok` and a result of `0.021` is `flagged` in the PDF and the
  exports

### Requirement: Every view uses the classification

The deforestation results table (cell text and colour), the per-layer free counter, the map's farm groups, its popup, the farm list colours, the percentage formatting and the PDF report (farm page text and colour, appendix colours) SHALL take the class of each result from the one classification function. No view SHALL decide "free" or "deforested" from `value` with its own comparison. A result SHALL be shown as deforestation-free only when its class is `ok`, and as having a finding only when it is `flagged`.

#### Scenario: Counters agree

- **WHEN** a layer has results `0`, `0.005`, `0.02`, `0.05` and `null`, and the threshold is 2
- **THEN** the free counter shows 3, the map's free group holds 3 farms, the table shows the deforestation-free label in 3 cells, and the PDF labels 3 farm pages as deforestation-free

#### Scenario: Below the threshold is free

- **WHEN** a result is `0.005` and the threshold is 2
- **THEN** the table cell, the map popup and the PDF farm page all show it as deforestation-free, and the free counter includes it

#### Scenario: A layer with no data at all

- **WHEN** every result of a layer is `null`
- **THEN** the free counter for that layer shows "N/A", not 0

### Requirement: Farms with no data are their own group on the map

The map view SHALL put each farm whose result for the selected layer is `unknown` in a "No data" group, separate from the deforestation-free and deforested groups, and SHALL NOT count it as deforestation-free. The "No data" group SHALL be shown only when it holds at least one farm.

#### Scenario: A farm outside the layer's coverage

- **WHEN** an analysis returns `null` for one farm (for example, a point outside the layer's raster) and `0` for the others
- **THEN** the map view lists that farm under "No data", the deforestation-free group does not include it, and its popup shows "N/A"

#### Scenario: Every farm has data

- **WHEN** every farm has a numeric result for the selected layer
- **THEN** the map view shows only the deforested and deforestation-free groups

#### Scenario: Switching layers from the "No data" group

- **WHEN** the "No data" group is open and the user selects a layer where every farm has a result
- **THEN** the map view shows the deforested group, without an error

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

