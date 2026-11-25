# product-configuration Specification

## Purpose
Product settings that both apps need, such as the overlap and deforestation thresholds, have a single owner: the API sets them from its environment and publishes them at `GET /config`, and the web loads them at startup instead of keeping its own copy.
## Requirements
### Requirement: The API owns product thresholds

The overlap threshold and the deforestation threshold SHALL be configured only in the API's environment, as `OVERLAP_THRESHOLD_PERCENTAGE` and `DEFORESTATION_THRESHOLD_PERCENTAGE`. Each SHALL be a number between 0 and 100, defaulting to 0, and the API SHALL refuse to start when either is set to anything else. The web SHALL NOT read these thresholds from its own environment.

#### Scenario: Invalid threshold

- **WHEN** the API starts with `DEFORESTATION_THRESHOLD_PERCENTAGE=150`
- **THEN** it fails at startup with an error naming the variable and the 0–100 range

#### Scenario: No web variables for thresholds

- **WHEN** the web's configuration files and its Container App definition are inspected
- **THEN** neither `NEXT_PUBLIC_OVERLAP_THRESHOLD_PERCENTAGE` nor `NEXT_PUBLIC_DEFORESTATION_THRESHOLD_PERCENTAGE` exists

### Requirement: Configuration endpoint

The API SHALL serve `GET /config` without authentication. It SHALL return `overlapThresholdPercentage` and `deforestationThresholdPercentage` as numbers, with a declared response model, reflecting the API's current environment.

#### Scenario: Thresholds published

- **WHEN** the API runs with `OVERLAP_THRESHOLD_PERCENTAGE=1` and `DEFORESTATION_THRESHOLD_PERCENTAGE=2`
- **THEN** `GET /config` returns `{"overlapThresholdPercentage": 1.0, "deforestationThresholdPercentage": 2.0}`

#### Scenario: Defaults

- **WHEN** neither variable is set
- **THEN** `GET /config` returns both thresholds as 0

### Requirement: The web loads its configuration before rendering

The web SHALL fetch `GET /config` when it starts and SHALL render the application only after the configuration has loaded. Every display of thresholds (labels, flags, colours, exports, the PDF report) SHALL use the loaded values. If the configuration cannot be loaded, the web SHALL show an error with a way to retry, in the user's language, instead of rendering with default values.

#### Scenario: Labels use the API's threshold

- **WHEN** `GET /config` returns `overlapThresholdPercentage` 1 and an overlap of 0.4% is shown
- **THEN** it is displayed as "< 1%"

#### Scenario: API unreachable at load

- **WHEN** `GET /config` fails
- **THEN** the web shows a translated error with a retry action, and no module page is rendered

### Requirement: Threshold-dependent percentages are displayed consistently

The web SHALL display overlap and deforestation percentages in the user's language, in the result tables, lists, maps and the Excel and GeoJSON downloads, as follows:

- 0 SHALL be displayed as "0%".
- With a threshold of 0, a value below 0.1% SHALL be displayed as "< 0.1%" (localized), and any other value with 1 decimal place.
- With a threshold above 0, a value at or below the threshold SHALL be displayed as "<" followed by the threshold, formatted as a percentage in the user's language.
- With a threshold above 0, a value above it SHALL be displayed with as many decimal places as the threshold has, and at least 1.

The PDF report formats its percentages on its own and is not covered by this requirement.

#### Scenario: A 1% threshold keeps one decimal

- **WHEN** the deforestation threshold is 1 and a farm's deforestation is 1.4%
- **THEN** it is displayed as "1,4%" in Spanish and "1.4%" in English

#### Scenario: Precision follows the threshold

- **WHEN** the deforestation threshold is 0.25 and a farm's deforestation is 2.8333%
- **THEN** it is displayed with 2 decimal places, "2,83%" in Spanish

#### Scenario: Integer threshold

- **WHEN** the deforestation threshold is 2 and a farm's deforestation is 10.4999%
- **THEN** it is displayed as "10,5%" in Spanish

#### Scenario: Below-threshold label is localized

- **WHEN** the overlap threshold is 0.5 and an overlap of 0.33% is shown in Spanish
- **THEN** it is displayed as "< 0,5%"

#### Scenario: Below an integer threshold

- **WHEN** the overlap threshold is 1 and an overlap of 0.4% is shown
- **THEN** it is displayed as "< 1%" in both languages

