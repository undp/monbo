## ADDED Requirements

### Requirement: API refuses to start without layers

At startup, the API SHALL check through the storage module that the layers root contains either `countries.json` (per-country layout) or `index.json` (flat layout). When it contains neither, including when the root directory does not exist, the API SHALL fail to start, with an error that names the resolved root and explains how to provide layers: mount the share or a layers folder and set `MAPS_ROOT`. The check SHALL run only at startup and SHALL NOT be part of `/health` or `/health/live`.

#### Scenario: Production image without a mounted root

- **WHEN** the API production image is started without `MAPS_ROOT` and without a mounted layers folder
- **THEN** the process exits during startup with an error naming the missing layers root
- **AND** it never answers `/health`

#### Scenario: Local development from the checkout

- **WHEN** the API is started from a checkout without `MAPS_ROOT`
- **THEN** it starts normally and serves the Git-tracked layers in `app/maps`

#### Scenario: Per-country root

- **WHEN** the API starts with `MAPS_ROOT` pointing at a root that holds `countries.json`
- **THEN** it starts normally

#### Scenario: Root emptied after startup

- **WHEN** the layers root loses its files while the API is running
- **THEN** the API keeps running and `/health` keeps its current response
