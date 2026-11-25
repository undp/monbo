## MODIFIED Requirements

### Requirement: Threshold-dependent percentages are displayed consistently

The web SHALL display overlap and deforestation percentages in the user's language, in the result tables, lists, maps, the PDF report and the Excel and GeoJSON downloads, as follows:

- 0 SHALL be displayed as "0%".
- With a threshold of 0, a value below 0.1% SHALL be displayed as "< 0.1%" (localized), and any other value with 1 decimal place.
- With a threshold above 0, a value at or below the threshold SHALL be displayed as "<" followed by the threshold, formatted as a percentage in the user's language.
- With a threshold above 0, a value above it SHALL be displayed with as many decimal places as the threshold has, and at least 1.
- A value below 100% that would round to "100%" SHALL be displayed as ">" followed by 100% minus one unit of its last decimal ("> 99,9%" with 1 decimal place, "> 99,99%" with 2), localized. A value within 1e-10 of 1 (floating-point noise of a farm covered entirely) SHALL be displayed as "100%".

The Excel finding column, a number rounded to 4 decimal places of a percent, is not covered by the text rules above.

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

#### Scenario: A finding just below the whole farm

- **WHEN** the deforestation threshold is 2 and a farm's deforestation is 99.95%
- **THEN** it is displayed as "> 99,9%" in Spanish and "> 99.9%" in English, never "100%"

#### Scenario: Two decimals just below the whole farm

- **WHEN** the deforestation threshold is 2.25 and a farm's deforestation is 99.996%
- **THEN** it is displayed as "> 99,99%" in Spanish

#### Scenario: A farm covered entirely

- **WHEN** a farm's deforestation comes back from the API as 1, or less than 1e-10 below it
- **THEN** it is displayed as "100%"

#### Scenario: An overlap just below the whole farm

- **WHEN** an overlap of 99.96% of the smaller farm is shown
- **THEN** it is displayed as "> 99,9%" in Spanish
