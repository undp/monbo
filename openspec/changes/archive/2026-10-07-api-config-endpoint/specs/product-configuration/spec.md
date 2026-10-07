## ADDED Requirements

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
