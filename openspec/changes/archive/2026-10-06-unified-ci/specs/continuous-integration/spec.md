## ADDED Requirements

### Requirement: Change detection decides which package jobs run

A single workflow (`.github/workflows/ci.yml`) SHALL hold the API job, the frontend job, and a change-detection job that runs first. Change detection SHALL classify every file of the pull request against its base branch, not only the latest push:

- a path under `apps/api/` SHALL select the API job;
- a path under `apps/web/` SHALL select the frontend job;
- a change to the CI workflow file SHALL select both.

The package jobs SHALL be skipped through their job-level condition when they are not selected. The workflow SHALL NOT use a workflow-level `paths` filter. Detection SHALL fail open:

- if the detection job fails, both package jobs SHALL run;
- if the pull request's file list cannot be read in full, both package jobs SHALL run.

Detection SHALL NOT depend on third-party actions and SHALL run with read-only permissions.

#### Scenario: Docs-only pull request

- **WHEN** a ready-for-review pull request into `dev` changes only files under `docs/`
- **THEN** both package jobs are skipped by their condition
- **AND** both required checks count as passed, and the pull request can be merged

#### Scenario: API-only pull request

- **WHEN** a pull request changes only files under `apps/api/`
- **THEN** "Test and static checks" runs and "Type-check, lint, build" is skipped

#### Scenario: Frontend-only pull request

- **WHEN** a pull request changes only files under `apps/web/`
- **THEN** "Type-check, lint, build" runs and "Test and static checks" is skipped

#### Scenario: Workflow change runs everything

- **WHEN** a pull request changes `.github/workflows/ci.yml`
- **THEN** both package jobs run

#### Scenario: Later push widens the scope

- **WHEN** a pull request that only changed docs receives a push that changes `apps/api/`
- **THEN** the run for that push runs "Test and static checks"

#### Scenario: Detection failure never skips tests

- **WHEN** the change-detection job fails, or the pull request has more files than the API can list
- **THEN** both package jobs run

## MODIFIED Requirements

### Requirement: Frontend CI pipeline

A GitHub Actions job named "Type-check, lint, build" in the CI workflow SHALL validate the frontend on every eligible pull request that change detection selects for it. It SHALL install with a frozen lockfile and run type-check (`tsc --noEmit`), lint, and build in `apps/web`. The job SHALL cache the pnpm store and `.next/cache` to keep runs fast. `start:standalone` SHALL NOT be represented as a CI step; it is a separate documented manual acceptance check for PR 8.

#### Scenario: Frontend checks gate a pull request

- **WHEN** an eligible pull request touches the frontend
- **THEN** CI runs `pnpm install --frozen-lockfile`, `tsc --noEmit`, lint, and build
- **AND** the pull request is blocked if any step fails

#### Scenario: Build caches are reused

- **WHEN** the frontend job runs
- **THEN** it restores and saves the pnpm store and `.next/cache`

### Requirement: API CI pipeline

A GitHub Actions job named "Test and static checks" in the CI workflow SHALL validate the API on every eligible pull request that change detection selects for it. It SHALL run, in `apps/api`, `uv sync --frozen`, `uv run pytest` (including the deterministic numeric baseline), and the lint/type checks (ruff, black, mypy). A temporary report-only bootstrap using `continue-on-error` MAY be used only to expose inherited failures while the repair tasks are in progress. It SHALL be visibly documented as staging and SHALL NOT satisfy the final acceptance requirement. Once pytest and the static checks are repaired, all `continue-on-error` settings SHALL be removed.

#### Scenario: Bootstrap CI reports inherited failures

- **WHEN** the API workflow is first introduced while documented inherited pytest/static-check failures remain
- **THEN** pytest, ruff, black, and mypy still execute and report their results
- **AND** any `continue-on-error` is identified as temporary report-only staging with a linked removal task

#### Scenario: API checks gate a pull request

- **WHEN** an eligible pull request touches the API
- **THEN** CI runs `uv sync --frozen`, `uv run pytest`, and ruff/black/mypy
- **AND** none of those validation steps uses `continue-on-error`
- **AND** the pull request is blocked if any step fails

### Requirement: Required checks enforce merge blocking

Repository rulesets SHALL require the final frontend and API job checks on both `main` and `dev`. Workflow failure semantics alone are insufficient: the required check names SHALL be recorded and a failing required check SHALL prevent merging. Each ruleset SHALL target its branch by name (`refs/heads/main`, `refs/heads/dev`) and SHALL NOT target `~DEFAULT_BRANCH`, so changing the default branch cannot move or remove a branch's protection. Both branches SHALL require a pull request, block force pushes and deletions, and keep an empty bypass list. The required checks are job names ("Test and static checks", "Type-check, lint, build"). Renaming those jobs or moving them to another workflow SHALL NOT change the names. A required job MAY be satisfied by being skipped through its own condition, and SHALL NOT be satisfied by being skipped because a job it depends on failed.

#### Scenario: Branch protection rejects a failing change

- **WHEN** either required frontend or API check fails on a ready-for-review pull request into `main` or `dev`
- **THEN** repository merge controls report the required check as unsuccessful
- **AND** the pull request cannot be merged until both required checks pass

#### Scenario: Protection survives a default-branch change

- **WHEN** the repository's default branch changes
- **THEN** `main` and `dev` keep exactly the rules they had before

#### Scenario: No direct pushes to protected branches

- **WHEN** someone pushes commits directly to `main` or `dev`
- **THEN** the push is rejected and the change must arrive through a pull request

#### Scenario: Workflows merged without touching the rulesets

- **WHEN** the API and frontend jobs move into a single workflow file
- **THEN** the rulesets still match both checks by their unchanged job names

### Requirement: CI triggers on ready-for-review only

The CI workflow SHALL run for pull requests whose base branch is `dev` or `main`, on `opened`, `synchronize`, and `ready_for_review` events. Its jobs SHALL be skipped while a pull request is in draft, through a job-level condition (`github.event.pull_request.draft == false`) that also prevents fail-open detection from running them. Pull requests into any other base branch SHALL NOT trigger it. A new push to a pull request SHALL cancel that pull request's run in progress.

#### Scenario: Draft PRs skip CI

- **WHEN** a pull request is in draft state
- **THEN** the CI jobs are skipped

#### Scenario: Marking ready triggers CI

- **WHEN** a draft pull request is marked ready for review
- **THEN** the CI workflow runs

#### Scenario: Release pull request into main

- **WHEN** a ready-for-review pull request from `dev` into `main` is opened
- **THEN** the CI workflow runs and reports both required checks

#### Scenario: Stacked pull request

- **WHEN** a pull request targets a feature branch
- **THEN** the CI workflow does not run

#### Scenario: Superseded run is cancelled

- **WHEN** a new commit is pushed while the pull request's previous run is in progress
- **THEN** the previous run is cancelled and the new one reports the checks for the new head
