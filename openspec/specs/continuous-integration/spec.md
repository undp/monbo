# Continuous Integration

## Purpose

Define the checks that gate a pull request for each package, when they run, and how they are
enforced as required checks on `main` and `dev`.

## Requirements

### Requirement: Frontend CI pipeline

A GitHub Actions workflow SHALL validate the frontend on every eligible pull request by installing with a frozen lockfile and running type-check (`tsc --noEmit`), lint, and build. The workflow SHALL cache the pnpm store and `.next/cache` to keep runs fast. `start:standalone` SHALL NOT be represented as a CI step; it is a separate documented manual acceptance check for PR 8.

#### Scenario: Frontend checks gate a pull request

- **WHEN** an eligible pull request touches the frontend
- **THEN** CI runs `pnpm install --frozen-lockfile`, `tsc --noEmit`, lint, and build
- **AND** the pull request is blocked if any step fails

#### Scenario: Build caches are reused

- **WHEN** the frontend workflow runs
- **THEN** it restores and saves the pnpm store and `.next/cache`

### Requirement: API CI pipeline

A GitHub Actions workflow SHALL validate the API on every eligible pull request by running `uv sync --frozen`, `uv run pytest` (including the deterministic numeric baseline), and the lint/type checks (ruff, black, mypy). A temporary report-only bootstrap using `continue-on-error` MAY be used only to expose inherited failures while the repair tasks are in progress. It SHALL be visibly documented as staging and SHALL NOT satisfy the final acceptance requirement. Once pytest and the static checks are repaired, all `continue-on-error` settings SHALL be removed.

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

Repository rulesets SHALL require the final frontend and API workflow checks on both `main` and `dev`. Workflow failure semantics alone are insufficient: the required check names SHALL be recorded and a failing required check SHALL prevent merging. Each ruleset SHALL target its branch by name (`refs/heads/main`, `refs/heads/dev`) and SHALL NOT target `~DEFAULT_BRANCH`, so changing the default branch cannot move or remove a branch's protection. Both branches SHALL require a pull request, block force pushes and deletions, and keep an empty bypass list.

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

### Requirement: CI triggers on ready-for-review only

CI workflows SHALL run for pull requests on `opened`, `synchronize`, and `ready_for_review` events, and SHALL be skipped while a pull request is in draft (`if: github.event.pull_request.draft == false`).

#### Scenario: Draft PRs skip CI

- **WHEN** a pull request is in draft state
- **THEN** the CI jobs are skipped

#### Scenario: Marking ready triggers CI

- **WHEN** a draft pull request is marked ready for review
- **THEN** the CI workflows run
