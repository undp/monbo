## MODIFIED Requirements

### Requirement: Reproducible frozen installs in Docker

The API Dockerfiles SHALL install dependencies with `uv sync --frozen` so builds fail if `uv.lock` is out of date, and the production Dockerfile SHALL additionally pass `--no-dev` to exclude development dependencies. Both SHALL install prebuilt wheels only (`--no-build`), so a dependency that would need compiling fails the build instead of requiring a toolchain. Neither image SHALL install system GDAL packages or compilers: the geospatial wheels bundle their own GDAL.

#### Scenario: Production image excludes dev dependencies

- **WHEN** the production API image is built
- **THEN** dependencies are installed via `uv sync --frozen --no-dev --no-build`
- **AND** the build fails if `pyproject.toml` and `uv.lock` are inconsistent

#### Scenario: Dev image includes test tooling

- **WHEN** the development API image is built
- **THEN** dependencies are installed via `uv sync --frozen --no-build` including the `dev` group

#### Scenario: No system GDAL or compilers in the images

- **WHEN** the production or development API image is inspected
- **THEN** neither `gdal-bin`, `libgdal-dev`, nor a C/C++/Fortran compiler is installed, and rasterio loads the GDAL bundled in its wheel

#### Scenario: A dependency without a wheel

- **WHEN** a dependency in `uv.lock` has no prebuilt wheel for the image's platform
- **THEN** the image build fails at `uv sync` with an explicit error, rather than compiling it
