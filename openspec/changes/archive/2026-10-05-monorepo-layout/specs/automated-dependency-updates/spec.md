## MODIFIED Requirements

### Requirement: Dependabot covers all managed ecosystems

The Dependabot configuration SHALL declare an `updates` entry for every dependency surface in the monorepo so none drifts unwatched. Because Dependabot requires one entry per ecosystem and directory, the configuration SHALL cover: both pnpm projects (`npm` ecosystem at the repository root for the pinned orchestrator dependency and in `apps/web`), both Python `uv` projects (`uv` ecosystem in `apps/api` and `tools/update-gfw-tmf`), the Docker base images (`docker` ecosystem for each Dockerfile directory, `apps/api` and `apps/web`), and the GitHub Actions workflows (`github-actions` ecosystem). Docker coverage SHALL be verified against the non-standard `Dockerfile.dev` and `Dockerfile.prod` names rather than inferred from directory entries alone. When a package folder moves, its entries SHALL move with it in the same change.

#### Scenario: All ecosystems are watched

- **WHEN** Dependabot scans the repository
- **THEN** it manages updates for both pnpm lockfiles (root orchestrator and `apps/web`), the `uv.lock` files (`apps/api` and `tools/update-gfw-tmf`), the verified Dockerfile base images, and GitHub Actions references

#### Scenario: Non-standard Dockerfiles are proven covered

- **WHEN** Docker ecosystem coverage is validated
- **THEN** an actual Dependabot scan or test pull request demonstrates whether all four `Dockerfile.dev`/`Dockerfile.prod` files are detected
- **AND** any unsupported filename is assigned an explicit supported update strategy before Docker coverage is declared complete

#### Scenario: No entry points at a missing folder

- **WHEN** the `directory` values of `.github/dependabot.yml` are checked against the repository
- **THEN** every one exists
