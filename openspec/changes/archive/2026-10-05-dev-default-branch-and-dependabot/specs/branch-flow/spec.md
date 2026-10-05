## ADDED Requirements

### Requirement: dev is the default and integration branch

`dev` SHALL be the default branch of the repository. Feature, fix and dependency pull requests SHALL target `dev`. `main` SHALL change only through a release or a hotfix. The README SHALL state which branch is which, because the repository's landing page shows the default branch.

#### Scenario: New pull requests default to dev

- **WHEN** a contributor opens a pull request without choosing a base branch
- **THEN** its base branch is `dev`

#### Scenario: Visitors can tell dev from the release

- **WHEN** someone reads the README on the repository's landing page
- **THEN** it states that `dev` is the integration branch and `main` holds the latest release

### Requirement: Releases merge dev into main with a merge commit

A release SHALL be a pull request from `dev` into `main`. It SHALL be merged with a merge commit, never squashed or rebased, so `main` gains no commit that `dev` lacks and the next release pull request carries only new changes.

#### Scenario: A release does not diverge the branches

- **WHEN** a release pull request from `dev` into `main` is merged
- **THEN** every commit on `main` is also reachable from `dev`

### Requirement: Hotfixes return to dev

A fix that cannot wait for a release SHALL branch from `main` and merge into `main` through a pull request. It SHALL then be merged from `main` into `dev` through a pull request, so the next release does not revert it.

#### Scenario: A hotfix is not lost at the next release

- **WHEN** a hotfix pull request is merged into `main`
- **THEN** a pull request merging `main` into `dev` follows
- **AND** after it merges, the hotfix commit is reachable from `dev`
