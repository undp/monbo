## ADDED Requirements

### Requirement: An anonymous session ID per browser tab

The web SHALL create a random UUID v4 the first time it needs a session ID and SHALL keep it in `sessionStorage`, next to the selected country, for the life of the tab. When `sessionStorage` is unavailable, the ID SHALL live in memory for the page's life. The ID SHALL NOT be reset when the selected country changes. The web SHALL NOT store it in a cookie or in `localStorage`, and SHALL NOT derive it from anything about the user or the device.

#### Scenario: Same tab, same session

- **WHEN** a user uploads farms, reloads the page and runs an analysis in the same tab
- **THEN** both events carry the same session ID

#### Scenario: New tab, new session

- **WHEN** the same user opens Monbo in a second tab and uploads farms there
- **THEN** that upload's event carries a different session ID

#### Scenario: Country change keeps the session

- **WHEN** a user changes the selected country from CR to PE before an analysis
- **THEN** the next event carries the same session ID and the country PE

### Requirement: Requests carry the usage context in headers

The web SHALL send these headers on `POST /farms/parse`, `POST /polygons_validation/validate` and `POST /deforestation_analysis/analize`:
- `X-Monbo-Session`: the session ID;
- `X-Monbo-Country`: the selected country code;
- `X-Monbo-Module`: on `/farms/parse` only, `polygons-validation` or `deforestation-analysis`, after the page that sent the upload.

The API SHALL treat every one of them as optional. The request SHALL be processed the same with or without them, and with invalid values. An invalid value is a session that isn't a UUID, a country that isn't two uppercase letters, or an unknown module. The API SHALL record such a value as `null`. For `/deforestation_analysis/analize`, the event's country SHALL be the request body's `country`, not the header.

#### Scenario: Headers from the current web

- **WHEN** the web uploads farms from the deforestation analysis page with CR selected
- **THEN** the `upload` event has the tab's session ID, country `CR` and module `deforestation-analysis`

#### Scenario: Request without headers

- **WHEN** a client calls `/polygons_validation/validate` without the usage headers
- **THEN** the validation answers as before, and its event has `null` session and country

#### Scenario: Invalid session header

- **WHEN** a client sends `X-Monbo-Session: not-a-uuid`
- **THEN** the request succeeds and its event has a `null` session

### Requirement: The API records an event for each upload, validation and analysis

The API SHALL record exactly one event for every request to `POST /farms/parse` (`upload`), `POST /polygons_validation/validate` (`validation`) and `POST /deforestation_analysis/analize` (`analysis`), whatever its result. The event's outcome SHALL be:
- `ok` when the status code is below 400;
- `invalid_input` from 400 to 499;
- `server_error` from 500 on, and when the request raises an unhandled exception.

That includes a 422 raised before the route runs.

On success, the event SHALL carry these counts:
- **`upload`:** `farms` (farms returned), `polygons` and `points` (farms of each polygon type).
- **`validation`:** `farms` (farms validated) and `invalidFarms` (farms reported `NOT_VALID`).
- **`analysis`:** `farms` (farms analyzed) and `maps` (layers analyzed).

On an error, the counts SHALL be absent.

#### Scenario: Successful upload

- **WHEN** `/farms/parse` returns 120 farms, 112 polygons and 8 points
- **THEN** one `upload` event is recorded with outcome `ok`, `farms` 120, `polygons` 112 and `points` 8

#### Scenario: Rejected upload

- **WHEN** `/farms/parse` answers 400 because of an invalid country code in a row
- **THEN** one `upload` event is recorded with outcome `invalid_input` and no counts

#### Scenario: Body that fails request validation

- **WHEN** `/deforestation_analysis/analize` answers 422 because the body is malformed
- **THEN** one `analysis` event is recorded with outcome `invalid_input`

#### Scenario: Server error

- **WHEN** `/polygons_validation/validate` raises an unhandled exception
- **THEN** one `validation` event is recorded with outcome `server_error`, and the client gets a 500

### Requirement: The browser reports report requests and downloads

The web SHALL send events to `POST /events`:
- **`report_requested`:** when the user clicks "Generate report" with at least one farm selected, with `farms` set to the number of selected farms. A click with no farm selected SHALL NOT send it.
- **`report_downloaded`, outcome `ok`:** after a report is saved. `format` SHALL be `pdf` for the complete report (one PDF) and `zip` for the separated or large report (one PDF per farm), and `farms` the number of farms in it.
- **`report_downloaded`, outcome `error`:** when a download fails with the error message shown to the user, with the same `format` and `farms`.

Every event SHALL carry the session ID and the selected country. The web SHALL NOT send an event when the user cancels a large report, leaves the page during a render, or is sent back to re-run the analysis because a layer changed. The web SHALL send events in the background with `keepalive`, SHALL ignore their failures, and SHALL NOT show them to the user.

#### Scenario: Generate report

- **WHEN** a user selects 5 farms and clicks "Generate report"
- **THEN** a `report_requested` event with `farms` 5 is sent

#### Scenario: One PDF

- **WHEN** the user downloads the complete report of 5 farms
- **THEN** a `report_downloaded` event with outcome `ok`, `format` `pdf` and `farms` 5 is sent

#### Scenario: Several PDFs

- **WHEN** the user downloads the separated reports of 5 farms as a ZIP
- **THEN** a `report_downloaded` event with outcome `ok`, `format` `zip` and `farms` 5 is sent

#### Scenario: Cancelled large report

- **WHEN** the user cancels a large report's ZIP while it is being built
- **THEN** no `report_downloaded` event is sent

#### Scenario: Events endpoint down

- **WHEN** `POST /events` fails
- **THEN** the download completes and the user sees no error

### Requirement: Public events endpoint with a closed schema

`POST /events` SHALL be public. It SHALL have no authentication, no rate limit and no Origin check. It SHALL accept one event per request, with:
- `type`: `report_requested` or `report_downloaded`;
- `outcome`: `ok` or `error`;
- `session`: optional, a UUID;
- `country`: optional, two uppercase letters;
- `farms`: a non-negative integer, at most 100,000;
- `format`: `pdf` or `zip`, required for `report_downloaded` and absent otherwise.

It SHALL reject:
- unknown types and extra fields, with 422;
- bodies over 2 KB, with 413, before parsing them.

It SHALL stamp the event with the server's UTC time, never a time sent by the client. It SHALL answer 204 with no body. It SHALL record the event with `source: "browser"`.

#### Scenario: Valid event

- **WHEN** a client posts `{"type":"report_downloaded","outcome":"ok","format":"zip","farms":12,"country":"PE"}`
- **THEN** the response is 204 and the event is recorded with the server's time and `source` `browser`

#### Scenario: Unknown event type

- **WHEN** a client posts `{"type":"page_view"}`
- **THEN** the response is 422 and nothing is recorded

#### Scenario: Oversized body

- **WHEN** a client posts a 10 KB body
- **THEN** the response is 413 and nothing is recorded

#### Scenario: Client time ignored

- **WHEN** a client posts an event with an `at` field
- **THEN** the response is 422 for the extra field

### Requirement: Events never carry farm data

An event SHALL contain only:
- the schema version;
- the server's UTC timestamp;
- the type, the outcome and the source (`server` or `browser`);
- the session ID, the country and the module;
- the counts and the format named in the requirements above.

It SHALL NOT contain farm IDs, producer names, coordinates, geometries, file names, request bodies, IP addresses or user agents.

#### Scenario: Analysis event content

- **WHEN** an analysis of farms with producer names and coordinates succeeds
- **THEN** its event has only the allowed fields, and none of the farms' values

### Requirement: Events are appended to monthly files per process

When `USAGE_DIR` is set, the API SHALL append each event as one JSON line to `<USAGE_DIR>/<YYYY-MM>/<replica>-<pid>.jsonl`:
- **`YYYY-MM`** is the event's UTC month.
- **`<replica>`** is `CONTAINER_APP_REPLICA_NAME`, or the host name when it is unset.
- **`<pid>`** is the ID of the writing process.

No two processes SHALL write to the same file, and writes from one process SHALL be serialized, so lines never interleave. The API SHALL also write every event to stdout as a single JSON line, whether or not `USAGE_DIR` is set. A failure to write an event SHALL be logged and SHALL NOT change the response of the request that caused it. Production SHALL set `USAGE_DIR` to `/mnt/maps/usage`.

#### Scenario: Event file

- **WHEN** process 1 of replica `monbo-api--r7-abc` records an event on 2026-11-09 UTC
- **THEN** a line is appended to `2026-11/monbo-api--r7-abc-1.jsonl` under `USAGE_DIR`

#### Scenario: Several worker processes

- **WHEN** the API runs with several uvicorn workers and two of them record an event
- **THEN** each line is appended to its own process's file, and neither file holds a mixed line

#### Scenario: Share unavailable

- **WHEN** the event file can't be written during an analysis
- **THEN** the analysis returns its results, and the failure is logged

#### Scenario: Not configured

- **WHEN** the API runs without `USAGE_DIR`
- **THEN** events are written to stdout only, and no file is created

#### Scenario: Not a country folder

- **WHEN** `USAGE_DIR` is `/mnt/maps/usage` and the layers root is `/mnt/maps`
- **THEN** the layers store doesn't list `usage` as a country
