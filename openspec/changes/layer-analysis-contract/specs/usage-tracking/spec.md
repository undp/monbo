## MODIFIED Requirements

### Requirement: Requests carry the usage context in headers

The web SHALL send these headers on `POST /farms/parse`, `POST /polygons_validation/validate` and `POST /layer_analysis/analyze`:
- `X-Monbo-Session`: the session ID;
- `X-Monbo-Country`: the selected country code;
- `X-Monbo-Module`: on `/farms/parse` only, `polygons-validation` or `deforestation-analysis`, after the page that sent the upload.

The API SHALL treat every one of them as optional. The request SHALL be processed the same with or without them, and with invalid values. An invalid value is a session that isn't a UUID, a country that isn't two uppercase letters, or an unknown module. The API SHALL record such a value as `null`. For `/layer_analysis/analyze`, the event's country SHALL be the request body's `country`, not the header.

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

The API SHALL record exactly one event for every request to `POST /farms/parse` (`upload`), `POST /polygons_validation/validate` (`validation`) and `POST /layer_analysis/analyze` (`analysis`), whatever its result. The event's outcome SHALL be:
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

- **WHEN** `/layer_analysis/analyze` answers 422 because the body is malformed
- **THEN** one `analysis` event is recorded with outcome `invalid_input`

#### Scenario: Server error

- **WHEN** `/polygons_validation/validate` raises an unhandled exception
- **THEN** one `validation` event is recorded with outcome `server_error`, and the client gets a 500
