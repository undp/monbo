## ADDED Requirements

### Requirement: Root orchestrator delegates per-package commands

A root `package.json` SHALL provide orchestrator scripts (`dev`, `test`, `lint`, `build`) that delegate to each package without a shared workspace. Node/frontend commands SHALL delegate via `pnpm --dir <pkg>` and Python commands via `uv run --directory <pkg>`. This is "option A": no `pnpm-workspace.yaml` and no Turborepo. Root-only orchestration tools SHALL be declared as exact devDependencies rather than fetched dynamically.

#### Scenario: Root script delegates to the right package tool

- **WHEN** a developer runs a root orchestrator script (e.g. `build`)
- **THEN** it invokes the corresponding command in each package via `pnpm --dir` (frontend) or `uv run --directory` (Python)

#### Scenario: Parallel dev via concurrently

- **WHEN** the root `dev` script is run
- **THEN** the frontend and API dev servers start in parallel via `pnpm exec concurrently`
- **AND** `concurrently` is resolved from the exact root devDependency and committed root lockfile, without `pnpm dlx`

### Requirement: Package lockfiles remain in place and the root tool is locked

Existing package lockfiles SHALL remain in their respective packages. The orchestrator SHALL NOT move `monbo-front/pnpm-lock.yaml` or either package `uv.lock` to the repo root and SHALL NOT introduce a pnpm workspace. Because the root declares `concurrently`, it SHALL also commit a root `pnpm-lock.yaml` limited to the root orchestrator project.

#### Scenario: Lockfiles stay in place

- **WHEN** the root orchestrator is added
- **THEN** `monbo-front/pnpm-lock.yaml` and each Python package's `uv.lock` remain in their package directories
- **AND** the root `pnpm-lock.yaml` resolves the root `concurrently` devDependency reproducibly
- **AND** no `pnpm-workspace.yaml` is present at the repo root
