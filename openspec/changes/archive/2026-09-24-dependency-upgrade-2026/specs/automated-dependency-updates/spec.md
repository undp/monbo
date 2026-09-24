## ADDED Requirements

### Requirement: Dependabot keeps dependencies current under review

A Dependabot configuration (`.github/dependabot.yml`) SHALL check for available dependency updates on a weekly schedule. Minor and patch updates SHALL be grouped to keep pull-request volume low, while major updates SHALL be surfaced as separate pull requests so they can be reviewed and validated in isolation. Dependabot SHALL NOT automerge any pull request — every update is merged manually after CI passes and a human review. The number of concurrently open pull requests SHALL be bounded via `open-pull-requests-limit` so the queue stays manageable.

> Note: unlike Renovate, Dependabot has no "Dependency Dashboard" and no pre-approval mode — it opens pull requests directly on its schedule. Noise is controlled through weekly cadence, grouping, `open-pull-requests-limit`, and the no-automerge + CI-gate policy rather than through a manual-approval gate before the PR is created.

#### Scenario: Grouped minors and isolated majors on a weekly schedule

- **WHEN** the configured weekly schedule elapses and Dependabot detects available updates
- **THEN** minor and patch bumps are combined into grouped pull requests
- **AND** each major bump is raised as its own separate pull request

#### Scenario: No update is merged without review

- **WHEN** Dependabot opens a pull request
- **THEN** the pull request is not automerged
- **AND** it can only be merged after CI passes and a maintainer approves it

#### Scenario: Open pull requests are bounded

- **WHEN** the number of open Dependabot pull requests reaches `open-pull-requests-limit`
- **THEN** Dependabot does not open further pull requests until some are merged or closed

### Requirement: Dependabot covers all managed ecosystems

The Dependabot configuration SHALL declare an `updates` entry for every dependency surface in the monorepo so none drifts unwatched. Because Dependabot requires one entry per ecosystem and directory, the configuration SHALL cover: both pnpm projects (`npm` ecosystem at the repository root for the pinned orchestrator dependency and in `monbo-front`), both Python `uv` projects (`uv` ecosystem in `monbo-api` and `scripts/update-gfw-tmf`), the Docker base images (`docker` ecosystem for each Dockerfile directory), and the GitHub Actions workflows (`github-actions` ecosystem). Docker coverage SHALL be verified against the non-standard `Dockerfile.dev` and `Dockerfile.prod` names rather than inferred from directory entries alone.

#### Scenario: All ecosystems are watched

- **WHEN** Dependabot scans the repository
- **THEN** it manages updates for both pnpm lockfiles (root orchestrator and `monbo-front`), the `uv.lock` files (`monbo-api` and `scripts/update-gfw-tmf`), the verified Dockerfile base images, and GitHub Actions references

#### Scenario: Non-standard Dockerfiles are proven covered

- **WHEN** Docker ecosystem coverage is validated
- **THEN** an actual Dependabot scan or test pull request demonstrates whether all four `Dockerfile.dev`/`Dockerfile.prod` files are detected
- **AND** any unsupported filename is assigned an explicit supported update strategy before Docker coverage is declared complete

### Requirement: Mutable image and action references have an explicit policy

Implementation SHALL decide and document whether the `ghcr.io/astral-sh/uv` image referenced by Docker `COPY --from` is managed by Dependabot, and SHALL verify the chosen behavior. It SHALL also evaluate pinning third-party GitHub Actions to full commit SHAs with human-readable version comments. Whether SHA pinning is adopted or rejected, the decision and risk rationale SHALL be recorded and Dependabot SHALL be verified to update the chosen reference form.

#### Scenario: uv copy image scope is explicit

- **WHEN** Docker dependency scope is reviewed
- **THEN** the `ghcr.io/astral-sh/uv` `COPY --from` reference is explicitly included with verified automated updates or explicitly excluded with a named manual owner/process

#### Scenario: GitHub Action pinning policy is verifiable

- **WHEN** GitHub Actions update coverage is finalized
- **THEN** the repository records whether third-party actions use full commit SHAs or major tags and why
- **AND** a Dependabot update demonstrates that the selected reference form remains maintainable
