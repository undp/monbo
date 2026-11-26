## ADDED Requirements

### Requirement: The calculation section explains how percentages are written

The calculation section SHALL have a "More detail" block, in both languages, explaining the
percentages the report and the tables write with a sign instead of a figure:

- "< X%", where X is the category's threshold: the finding is at the threshold or below it; the
  farm counts as without findings on that layer, and the exact figure is not shown;
- "> X%": the finding is above the threshold but rounds to it; it counts as a finding;
- "< 0,1%" ("< 0.1%" in English): the category's threshold is 0 and the finding is above 0 but
  rounds to 0; it counts as a finding;
- "> 99,9%" ("> 99.9%"): the finding is below 100% but rounds to 100%;
- "0%": nothing of the farm is a finding.

It SHALL NOT state any category's threshold as a number.

#### Scenario: Texts with a sign explained

- **WHEN** a user opens the calculation section's "More detail" on how percentages are written
- **THEN** it explains "< X%", "> X%", "< 0,1%" and "> 99,9%", in Spanish and in English with
  the English decimal point
