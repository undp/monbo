## ADDED Requirements

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
