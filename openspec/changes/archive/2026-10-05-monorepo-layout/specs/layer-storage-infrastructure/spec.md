## MODIFIED Requirements

### Requirement: API image carries no layers

The API production image SHALL NOT contain any layer data: no rasters, no `index.json`, no `countries.json`, and no metadata. `app/maps/` SHALL be excluded from the API's Docker build context. The layers SHALL remain tracked in Git (Git LFS), so that a clone of the repository has working layers for local development, tests and seeding.

#### Scenario: Image without layers

- **WHEN** the API production image is built from a checkout whose `app/maps/` holds the six Git LFS rasters
- **THEN** the image contains no `app/maps/` directory
- **AND** the build context sent to Docker does not include `app/maps/`

#### Scenario: Clone keeps the layers

- **WHEN** a developer clones the repository and runs `git lfs pull`
- **THEN** `apps/api/app/maps/` contains the flat layout with its rasters, and the API started locally without `MAPS_ROOT` serves those layers
