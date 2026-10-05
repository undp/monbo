## MODIFIED Requirements

### Requirement: uv-managed Python dependencies

The `monbo-api` package, in `apps/api`, SHALL declare its dependencies in a `pyproject.toml` managed by uv, with a committed `uv.lock` as the single source of truth. Production dependencies SHALL live in the default dependency list and development-only tools (pytest, pytest-cov, ruff, black, mypy, memory-profiler) SHALL live in a `dev` dependency-group. Every declared dependency SHALL carry an exact version constraint, in the `dev` group as well as the production list, so that a lockfile refresh performed for one upgrade cannot silently re-roll the linting and typing toolchain. The legacy `requirements.txt` SHALL be removed, and the duplicated `fastapi` / `fastapi[standard]` declaration SHALL be collapsed into a single entry.

#### Scenario: Dependencies resolved from pyproject and lockfile

- **WHEN** a developer sets up `apps/api` from a clean checkout
- **THEN** `uv sync` installs the full environment from `pyproject.toml` resolved against `uv.lock`
- **AND** no `requirements.txt` file exists in `apps/api`

#### Scenario: Dev tools isolated from production dependencies

- **WHEN** the environment is installed without development groups (`uv sync --no-dev`)
- **THEN** pytest, pytest-cov, ruff, black, and mypy are absent while all production dependencies are present

#### Scenario: Dev tooling versions cannot drift on an unrelated lock refresh

- **WHEN** the `dev` dependency-group declarations are inspected
- **THEN** every entry carries an exact version constraint rather than an open range
- **AND** refreshing `uv.lock` for an unrelated dependency bump leaves the resolved ruff, black, mypy, and memory-profiler versions unchanged

#### Scenario: No duplicate FastAPI declaration

- **WHEN** the dependency declarations are inspected
- **THEN** FastAPI appears exactly once (as `fastapi[standard]`) with a single version constraint

### Requirement: uv-managed GFW/TMF update script

The `tools/update-gfw-tmf` tool SHALL also be managed with uv (`pyproject.toml` + `uv.lock`). The `tenacity` upper bound (`<9`) SHALL be removed and `earthengine-api` / `geemap` SHALL be upgraded to their current releases.

#### Scenario: Script dependencies upgraded and validated

- **WHEN** the GFW/TMF update script is run with the upgraded dependencies
- **THEN** a bounded run completes successfully and `gdalinfo` confirms valid output
- **AND** `tenacity` is no longer capped below version 9
