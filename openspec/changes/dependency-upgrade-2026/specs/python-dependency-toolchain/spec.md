## ADDED Requirements

### Requirement: uv-managed Python dependencies

The `monbo-api` package SHALL declare its dependencies in a `pyproject.toml` managed by uv, with a committed `uv.lock` as the single source of truth. Production dependencies SHALL live in the default dependency list and development-only tools (pytest, pytest-cov, ruff, black, mypy) SHALL live in a `dev` dependency-group. The legacy `requirements.txt` SHALL be removed, and the duplicated `fastapi` / `fastapi[standard]` declaration SHALL be collapsed into a single entry.

#### Scenario: Dependencies resolved from pyproject and lockfile

- **WHEN** a developer sets up `monbo-api` from a clean checkout
- **THEN** `uv sync` installs the full environment from `pyproject.toml` resolved against `uv.lock`
- **AND** no `requirements.txt` file exists in `monbo-api`

#### Scenario: Dev tools isolated from production dependencies

- **WHEN** the environment is installed without development groups (`uv sync --no-dev`)
- **THEN** pytest, pytest-cov, ruff, black, and mypy are absent while all production dependencies are present

#### Scenario: No duplicate FastAPI declaration

- **WHEN** the dependency declarations are inspected
- **THEN** FastAPI appears exactly once (as `fastapi[standard]`) with a single version constraint

### Requirement: Reproducible frozen installs in Docker

The API Dockerfiles SHALL install dependencies with `uv sync --frozen` so builds fail if `uv.lock` is out of date, and the production Dockerfile SHALL additionally pass `--no-dev` to exclude development dependencies.

#### Scenario: Production image excludes dev dependencies

- **WHEN** the production API image is built
- **THEN** dependencies are installed via `uv sync --frozen --no-dev`
- **AND** the build fails if `pyproject.toml` and `uv.lock` are inconsistent

#### Scenario: Dev image includes test tooling

- **WHEN** the development API image is built
- **THEN** dependencies are installed via `uv sync --frozen` including the `dev` group

### Requirement: Python 3.12 runtime baseline

The API SHALL target Python 3.12 as its runtime baseline. `requires-python` SHALL declare Python 3.12 as the minimum supported interpreter (for example, `>=3.12`), while `.python-version` SHALL select the concrete Python 3.12 development/CI interpreter. The Docker base images SHALL be `python:3.12-slim`, and the authoritative mypy `python_version` SHALL be raised to 3.12 without a conflicting duplicate configuration at the repository root.

#### Scenario: Interpreter version is pinned to 3.12

- **WHEN** the toolchain resolves the Python interpreter for `monbo-api`
- **THEN** `.python-version` selects the approved Python 3.12 interpreter
- **AND** `requires-python` rejects interpreters below Python 3.12 without falsely representing its lower-bound constraint as an exact pin

#### Scenario: Docker images run on Python 3.12

- **WHEN** either API image is built
- **THEN** the base image is `python:3.12-slim`

### Requirement: Numeric correctness under rasterio 1.5 and numpy 2

The numpy 2 correctness gate SHALL apply when numpy 2 first enters the committed dependency graph and again when Python 3.12/rasterio 1.5 lands. Because the PR 1 `uv.lock` already resolves numpy 2.4.6, PR 1 SHALL NOT be accepted merely as a tooling-only migration: the inherited pytest failures SHALL first be repaired and the comparison below SHALL pass before PR 1, and it SHALL be rerun as a hard gate in PR 4.

The gate SHALL use a deterministic, version-controlled fixture containing fixed local inputs (including the analysis geometry and raster/source data) with no network, clock, or mutable external-data dependency. Expected scalar ratios, raster outputs, and rendered imagery SHALL be captured from the approved pre-upgrade Python 3.11/rasterio 1.4/numpy 1 environment, with the exact dependency/tool versions recorded. Linux x86_64 in GitHub Actions is the blocking reference platform; results on other developer platforms are informative unless they are explicitly added to the supported matrix.

"Within accepted tolerance" SHALL mean all of the following, enforced automatically in pytest:

- scalar deforestation ratios satisfy `math.isclose(actual, expected, rel_tol=1e-6, abs_tol=1e-8)`;
- generated rasters have exactly equal CRS, affine transform, dimensions, band count, dtype, nodata value, and valid/nodata mask, and every valid numeric pixel satisfies `numpy.allclose(..., rtol=1e-6, atol=1e-8, equal_nan=True)`;
- rendered images are decoded before comparison, have exactly equal dimensions and channel count, have no more than 0.1% differing channel values, and every differing 8-bit channel has an absolute delta no greater than 1.

Changing the fixture, baseline values, or tolerances SHALL require an explicit reviewed rationale; regenerating expected outputs with the candidate numpy 2 environment is not evidence of compatibility.

#### Scenario: Baseline is established before numpy 2 acceptance

- **WHEN** PR 1's uv migration resolves numpy 2 in `uv.lock`
- **THEN** the full repaired pytest suite passes on Linux x86_64
- **AND** the automated fixture comparison passes against the version-controlled numpy 1 reference using the specified tolerances
- **AND** PR 1 is blocked if either condition fails

#### Scenario: Deforestation results unchanged after numpy 2 upgrade

- **WHEN** the deterministic fixture is run after the Python 3.12 / rasterio 1.5 upgrade in PR 4
- **THEN** scalar ratios, raster outputs, and decoded rendered images match the version-controlled numpy 1 reference using the specified tolerances
- **AND** the pytest suite passes
- **AND** PR 4 is blocked if either condition fails

### Requirement: uv-managed GFW/TMF update script

The `scripts/update-gfw-tmf` tool SHALL also be managed with uv (`pyproject.toml` + `uv.lock`). The `tenacity` upper bound (`<9`) SHALL be removed and `earthengine-api` / `geemap` SHALL be upgraded.

#### Scenario: Script dependencies upgraded and validated

- **WHEN** the GFW/TMF update script is run with the upgraded dependencies
- **THEN** a bounded run completes successfully and `gdalinfo` confirms valid output
- **AND** `tenacity` is no longer capped below version 9
