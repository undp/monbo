## MODIFIED Requirements

### Requirement: Admin usage page

The frontend SHALL provide `/[locale]/admin/usage`, behind the admin login like the other admin pages. Its title SHALL be "App usage" ("Uso de la aplicación"), under the "Admin" eyebrow alone, without the session's country: the page covers every country. It SHALL show:
- **a date range,** with presets "Last 30 days", "Last 90 days" and "This year", and custom dates;
- **tiles with the totals,** each with an icon and its weekly trend as a sparkline:
  - sessions;
  - farm uploads, and the average farms per upload;
  - deforestation analyses, and the sessions that analyzed;
  - reports requested, and the sessions that requested them;
  - reports downloaded, as one PDF and as a ZIP;
- **a donut chart per metric with each country's percentage:** sessions, uploads, analyses and reports downloaded. A country SHALL keep the same color in every donut, with one shared legend. Past five named countries, the rest and the unknown country SHALL fold into "Other". Each percentage SHALL be of the metric's sum over the country rows: a session with events in several countries counts in each, and the page SHALL say so. Each donut SHALL also list its countries with their count and percentage as text;
- **a usage funnel:** sessions, sessions that uploaded, that analyzed and that requested a report, each with its percentage of all sessions;
- **successes and errors by step,** stacked: successful, invalid input and failed, for upload, validation, analysis and report download;
- **a weekly line chart** of sessions, analyses and reports downloaded;
- **a table with one row per country:** the country's name (`unknown` shown as "Unknown country"), and its uploads, average farms per upload, validations, analyses, reports requested and reports downloaded, with successes and errors side by side.

The page SHALL say the figures count browser sessions, not people. Report figures SHALL be labelled "Reported by the browser"; upload, validation and analysis figures "Recorded by the server". All text SHALL be in `en` and `es`, with numbers and percentages formatted for the UI language.

#### Scenario: Open the usage page

- **WHEN** a PE admin opens the usage page
- **THEN** the page is titled "App usage" under the "Admin" eyebrow, without "Peru", and shows the last 30 days: the totals of every country, the donuts, the funnel, the outcomes, the weekly chart and a row for each country with events

#### Scenario: Country shares

- **WHEN** CR has 3 uploads and PE has 1 in the range
- **THEN** the uploads donut shows CR at 75 % and PE at 25 %, in the same colors as in the other donuts

#### Scenario: A session in two countries

- **WHEN** the range holds one session, with events in CR and in PE
- **THEN** the sessions tile shows 1, and the sessions donut shows CR and PE with 1 session each, at 50 %

#### Scenario: Change the range

- **WHEN** the admin picks "This year"
- **THEN** the tiles, the charts and the table show the figures from January 1 to today

#### Scenario: No events

- **WHEN** the range holds no events
- **THEN** the tiles show 0, the average shows "—", the donuts say there is no data, and the table says there is no usage in the range

#### Scenario: Labels

- **WHEN** the admin looks at the reports downloaded
- **THEN** they are labelled "Reported by the browser", and the uploads "Recorded by the server"
