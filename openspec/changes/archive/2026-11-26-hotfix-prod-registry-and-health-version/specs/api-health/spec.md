## ADDED Requirements

### Requirement: Health reports the API version

`GET /health` SHALL report, in its `version` field, the version the API is released as: the same value as the FastAPI application's `version` and as `version` in `apps/api/pyproject.toml`. The version SHALL NOT be written a second time for `/health`.

#### Scenario: Health matches the released version

- **WHEN** a client calls `GET /health` on an API released as 2.0.1
- **THEN** the response's `version` is `2.0.1`

#### Scenario: A release bump reaches health

- **WHEN** a release changes the API's version in `pyproject.toml` and the FastAPI application
- **THEN** `GET /health` reports the new version without any other edit
