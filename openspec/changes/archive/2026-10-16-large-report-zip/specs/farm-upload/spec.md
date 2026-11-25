## ADDED Requirements

### Requirement: Upload errors are summarized

When an uploaded farms file has validation errors, in "Polygon validation" or in "Deforestation analysis", the web SHALL show at most 5 error notices, one per error in file order. When there are more, it SHALL add one notice saying how many other errors there are, in the user's language. The upload SHALL still stop on any error, as today.

#### Scenario: Few errors

- **WHEN** the uploaded file has 3 rows with errors
- **THEN** 3 error notices are shown, one per row, and no summary notice

#### Scenario: Many errors

- **WHEN** the uploaded file has 1000 rows missing a mandatory column
- **THEN** 5 error notices are shown for the first 5 rows, plus one notice saying there are 995 more errors, and the page stays responsive
