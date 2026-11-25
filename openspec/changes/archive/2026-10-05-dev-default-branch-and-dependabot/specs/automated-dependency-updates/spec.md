## ADDED Requirements

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
