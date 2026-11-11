## ADDED Requirements

### Requirement: Usage aggregates for any admin

`GET /admin/usage` SHALL require a valid admin session token, like every admin route. It SHALL return the figures for every country, whatever the session's country. It is the only admin route not limited to the session's country.

It SHALL take `from` and `to` as UTC dates (`YYYY-MM-DD`), both included:
- without them, it SHALL cover the 30 days ending today;
- a range where `from` is after `to`, or longer than 366 days, SHALL get 422.

When `USAGE_DIR` isn't set, it SHALL answer 503 with a message saying usage metrics aren't configured.

#### Scenario: Any country sees all countries

- **WHEN** a CR admin requests the usage for a month in which CR and PE recorded events
- **THEN** the response has the totals of both countries and a row for each

#### Scenario: Default range

- **WHEN** an admin calls `GET /admin/usage` without parameters on 2026-11-09
- **THEN** the response covers 2026-10-11 to 2026-11-09

#### Scenario: Range too long

- **WHEN** an admin asks for 2025-01-01 to 2026-06-30
- **THEN** the response is 422

#### Scenario: Without a token

- **WHEN** a client calls `GET /admin/usage` without a token
- **THEN** the response is 401

#### Scenario: Not configured

- **WHEN** the API runs without `USAGE_DIR` and an admin opens the usage page
- **THEN** the API answers 503, and the page says usage metrics aren't configured on this server

### Requirement: What the aggregates count

The response SHALL hold one block for the overall totals, one block for each country with events in the range, and one block for each ISO week (Monday to Sunday, UTC) that overlaps the range. Each block SHALL have:
- **`upload`:**
  - `ok`, and `errors` split into `invalid_input` and `server_error`;
  - `sessions`: distinct sessions with at least one `ok` upload;
  - the sums of `farms`, `polygons` and `points` over `ok` uploads;
  - `avgFarmsPerUpload`: `farms` ÷ `ok`, or `null` when there is no `ok` upload.
- **`validation`:** `ok`, `errors` as above, `sessions`, and the sums of `farms` and `invalidFarms`.
- **`analysis`:** `ok`, `errors` as above, `sessions`, and the sum of `farms`.
- **`reports`:**
  - `requested`, and `requestedSessions`;
  - `downloaded` split into `pdf` and `zip`;
  - `downloadErrors`;
  - `farmsDownloaded`.
- **`sessions`:** distinct sessions with any event.

Session counts SHALL count distinct non-null session IDs. Events without a session SHALL count in every other figure. Events without a country SHALL count in the totals and in a country row with code `unknown`. Lines that aren't valid events SHALL be skipped. The response SHALL list the event sources: `reports` comes from the browser, everything else from the server.

#### Scenario: Average farms per upload

- **WHEN** a range holds `ok` uploads of 10, 20 and 60 farms and one `invalid_input` upload
- **THEN** `upload.ok` is 3, `upload.errors.invalid_input` is 1, `upload.farms` is 90 and `avgFarmsPerUpload` is 30

#### Scenario: Sessions are distinct

- **WHEN** one session runs three analyses and another runs one
- **THEN** `analysis.ok` is 4 and `analysis.sessions` is 2

#### Scenario: PDF versus ZIP

- **WHEN** a range holds 3 `report_downloaded` events with `format` `pdf` and 2 with `zip`, all `ok`
- **THEN** `reports.downloaded.pdf` is 3 and `reports.downloaded.zip` is 2

#### Scenario: Torn line

- **WHEN** an event file ends with half a line
- **THEN** that line is skipped and the other events are counted

#### Scenario: Events from an old client

- **WHEN** a range holds `upload` events without session or country
- **THEN** they count in `upload.ok` and in the `unknown` country row, but not in any `sessions` count

### Requirement: Closed months are summarized once

`GET /admin/usage` SHALL read a month before the current UTC month from its rollup, `<USAGE_DIR>/rollups/<YYYY-MM>.json`, and the current month from its event files. The rollup SHALL hold, for each UTC day and country of the month, the counters of every figure and the session IDs seen, with the steps each one took. It SHALL hold nothing an event may not carry.

When a request needs a closed month, the API SHALL build that month's rollup from its event files if it is missing, doesn't parse, has a version other than the code's, or if the month's event files changed since it was built: a file added or removed, or with another size or modification time. It SHALL write the rollup to a temporary file and rename it into place. A failure to write a rollup SHALL be logged, and the request SHALL answer from the event files.

The response SHALL be the same whether a month comes from its rollup or from its event files. The event reader SHALL read only `*.jsonl` files in folders named `YYYY-MM`.

#### Scenario: First request for a closed month

- **WHEN** an admin asks for October 2026 on 2026-11-09, and October has no rollup
- **THEN** the API builds `rollups/2026-10.json` from October's event files and answers from it

#### Scenario: Later request

- **WHEN** another admin asks for October 2026 after its rollup was built, and no October event file changed
- **THEN** the API answers from the rollup without reading October's event files

#### Scenario: Late event

- **WHEN** an event file of October 2026 is modified after October's rollup was built
- **THEN** the next request that needs October rebuilds its rollup

#### Scenario: Figures change

- **WHEN** a release changes the rollup version
- **THEN** each closed month's rollup is rebuilt the first time a request needs it

#### Scenario: Same answer either way

- **WHEN** an admin asks for the same range with and without the `rollups` folder
- **THEN** both responses are equal

#### Scenario: Rollup folder is not a month

- **WHEN** `USAGE_DIR` holds `2026-10/`, `2026-11/` and `rollups/`
- **THEN** the reader reads events only from `2026-10/` and `2026-11/`

### Requirement: Admin usage page

The frontend SHALL provide `/[locale]/admin/usage`, behind the admin login like the other admin pages. Its title SHALL be "App usage" ("Uso de la aplicación"), without the "Layers admin" overline and without the session's country: the page covers every country. It SHALL show:
- **a date range,** with presets "Last 30 days", "Last 90 days" and "This year", and custom dates;
- **tiles with the totals,** each with an icon and its weekly trend as a sparkline:
  - sessions;
  - farm uploads, and the average farms per upload;
  - deforestation analyses, and the sessions that analyzed;
  - reports requested, and the sessions that requested them;
  - reports downloaded, as one PDF and as a ZIP;
- **a donut chart per metric with each country's percentage:** sessions, uploads, analyses and reports downloaded. A country SHALL keep the same color in every donut, with one shared legend. Past five named countries, the rest and the unknown country SHALL fold into "Other". Each donut SHALL also list its countries with their count and percentage as text;
- **a usage funnel:** sessions, sessions that uploaded, that analyzed and that requested a report, each with its percentage of all sessions;
- **successes and errors by step,** stacked: successful, invalid input and failed, for upload, validation, analysis and report download;
- **a weekly line chart** of sessions, analyses and reports downloaded;
- **a table with one row per country:** the country's name (`unknown` shown as "Unknown country"), and its uploads, average farms per upload, validations, analyses, reports requested and reports downloaded, with successes and errors side by side.

The page SHALL say the figures count browser sessions, not people. Report figures SHALL be labelled "Reported by the browser"; upload, validation and analysis figures "Recorded by the server". All text SHALL be in `en` and `es`, with numbers and percentages formatted for the UI language.

#### Scenario: Open the usage page

- **WHEN** a PE admin opens the usage page
- **THEN** the page is titled "App usage", without "Peru", and shows the last 30 days: the totals of every country, the donuts, the funnel, the outcomes, the weekly chart and a row for each country with events

#### Scenario: Country shares

- **WHEN** CR has 3 uploads and PE has 1 in the range
- **THEN** the uploads donut shows CR at 75 % and PE at 25 %, in the same colors as in the other donuts

#### Scenario: Change the range

- **WHEN** the admin picks "This year"
- **THEN** the tiles, the charts and the table show the figures from January 1 to today

#### Scenario: No events

- **WHEN** the range holds no events
- **THEN** the tiles show 0, the average shows "—", the donuts say there is no data, and the table says there is no usage in the range

#### Scenario: Labels

- **WHEN** the admin looks at the reports downloaded
- **THEN** they are labelled "Reported by the browser", and the uploads "Recorded by the server"
