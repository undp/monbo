# Automated Dependency Updates

## Purpose

Define how Dependabot keeps every managed ecosystem current, the review that each update must
pass, and the policy for mutable image and action references.
## Requirements
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

### Requirement: Mutable image and action references have an explicit policy

Implementation SHALL decide and document whether the `ghcr.io/astral-sh/uv` image referenced by Docker `COPY --from` is managed by Dependabot, and SHALL verify the chosen behavior. It SHALL also evaluate pinning third-party GitHub Actions to full commit SHAs with human-readable version comments. Whether SHA pinning is adopted or rejected, the decision and risk rationale SHALL be recorded and Dependabot SHALL be verified to update the chosen reference form.

#### Scenario: uv copy image scope is explicit

- **WHEN** Docker dependency scope is reviewed
- **THEN** the `ghcr.io/astral-sh/uv` `COPY --from` reference is explicitly included with verified automated updates or explicitly excluded with a named manual owner/process

#### Scenario: GitHub Action pinning policy is verifiable

- **WHEN** GitHub Actions update coverage is finalized
- **THEN** the repository records whether third-party actions use full commit SHAs or major tags and why
- **AND** a Dependabot update demonstrates that the selected reference form remains maintainable

### Requirement: Dependabot pull requests open against dev

All Dependabot pull requests, version updates and security updates alike, SHALL open against `dev`, the repository's default branch. The configuration SHALL achieve this by living on the default branch, not through `target-branch`. Setting `target-branch` would make the entries' options apply only to version updates and detach security updates from them.

#### Scenario: Version updates open against dev

- **WHEN** Dependabot opens a version-update pull request for any configured ecosystem
- **THEN** the pull request's base branch is `dev`

#### Scenario: Security updates open against dev

- **WHEN** Dependabot opens a security-update pull request
- **THEN** the pull request's base branch is `dev`
- **AND** it carries the labels configured for its ecosystem entry

#### Scenario: No entry sets target-branch

- **WHEN** a maintainer reads `.github/dependabot.yml`
- **THEN** no `updates` entry declares `target-branch`

### Requirement: Deferred upgrades are encoded as ignore rules

Every upgrade that a design decision defers or rejects SHALL be expressed as an `ignore` rule in `.github/dependabot.yml`, on the entry that would otherwise propose it. Each rule SHALL carry a comment naming its entry condition and the decision it comes from. A deferral SHALL be lifted by removing its rule once the entry condition is met. Ignores applied through `@dependabot ignore` PR comments SHALL NOT be used for policy, because they are not visible in the repository. Docker image tags whose runtime upgrade Dependabot classifies as a minor (for example `python:3.13` → `3.14`) SHALL be ignored with a version range rather than an update type.

#### Scenario: A deferred major is not proposed

- **WHEN** a new major of a deferred dependency is published (for example `@mui/material-nextjs` 9 while MUI 9 is deferred)
- **THEN** Dependabot opens no pull request for it

#### Scenario: A runtime tag classified as minor is not proposed

- **WHEN** a `python:3.14-slim` image is available and Python 3.14 is deferred
- **THEN** Dependabot does not propose it, neither alone nor inside the `minor-and-patch` group

#### Scenario: Each ignore rule explains itself

- **WHEN** a maintainer reads an `ignore` rule in `.github/dependabot.yml`
- **THEN** a comment next to it states the entry condition and the design decision that deferred the upgrade

### Requirement: Package updates wait out a release cooldown

The `npm` and `uv` entries SHALL configure a Dependabot `cooldown`, so a newly published release is proposed only after it has been public for a minimum number of days. Majors SHALL wait at least as long as minors and patches. The cooldown SHALL NOT apply to security updates.

#### Scenario: A same-day release is not proposed

- **WHEN** a package version is published less than the cooldown period ago
- **THEN** Dependabot does not propose it in a version-update pull request until the period has elapsed

#### Scenario: Security fixes are not delayed

- **WHEN** a security advisory has a patched version within the cooldown period
- **THEN** the security update is proposed without waiting for the cooldown

### Requirement: Security updates are enabled

Dependabot security updates SHALL be enabled for the repository. They follow the normal flow into `dev` and reach `main` with the next release. A fix that production cannot wait for SHALL use the hotfix path defined by `branch-flow`.

#### Scenario: A vulnerable dependency gets a pull request

- **WHEN** a Dependabot alert opens for a dependency with a patched version
- **THEN** Dependabot opens a security-update pull request against `dev`

#### Scenario: An urgent fix reaches production

- **WHEN** a security fix must reach production before the next release
- **THEN** it is applied through a hotfix pull request into `main`
- **AND** `main` is then merged into `dev`, and the Dependabot pull request on `dev` is merged or closed as superseded

### Requirement: Configured labels exist

Every label referenced in `.github/dependabot.yml` SHALL exist in the repository, so Dependabot can apply it to the pull requests it opens.

#### Scenario: Pull requests are labelled without warnings

- **WHEN** Dependabot opens a pull request for any configured entry
- **THEN** the pull request carries the entry's labels
- **AND** Dependabot posts no "labels could not be found" comment

