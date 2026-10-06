## ADDED Requirements

### Requirement: Repository layout

Deployable applications SHALL live under `apps/`: the API in `apps/api` and the web frontend in `apps/web`. Operational tools that are not deployed SHALL live under `tools/`, starting with `tools/update-gfw-tmf`. Folder names SHALL NOT determine deployed identifiers. The package names (`monbo-api`, `monbo-front`), the Docker image names, the Container App names and the CI job names SHALL stay independent of the folders, so moving a folder does not rename anything deployed or required by branch protection. The layout SHALL NOT introduce a pnpm workspace or Turborepo.

#### Scenario: Applications under apps

- **WHEN** a developer lists the repository root
- **THEN** the API is in `apps/api` and the frontend in `apps/web`, and there is no `monbo-api/`, `monbo-front/` or `scripts/` folder

#### Scenario: Deployed names unaffected by folders

- **WHEN** the API image is built from `apps/api`
- **THEN** it is still published as `monbo-api` and deployed to the `monbo-api` Container App, and the CI checks keep their required job names

#### Scenario: History follows the move

- **WHEN** a developer runs `git log --follow` on a file under `apps/` or `tools/`
- **THEN** the history from before the move is shown

## MODIFIED Requirements

### Requirement: Root orchestrator delegates per-package commands

A root `package.json` SHALL provide orchestrator scripts (`dev`, `test`, `lint`, `build`) that delegate to each package without a shared workspace. Node/frontend commands SHALL delegate via `pnpm --dir <pkg>` and Python commands via `uv run --directory <pkg>`, where `<pkg>` is the package's folder under `apps/`. This is "option A": no `pnpm-workspace.yaml` and no Turborepo. Root-only orchestration tools SHALL be declared as exact devDependencies rather than fetched dynamically.

#### Scenario: Root script delegates to the right package tool

- **WHEN** a developer runs a root orchestrator script (e.g. `build`)
- **THEN** it invokes the corresponding command in each package via `pnpm --dir apps/web` (frontend) or `uv run --directory apps/api` (Python)

#### Scenario: Parallel dev via concurrently

- **WHEN** the root `dev` script is run
- **THEN** the frontend and API dev servers start in parallel via `pnpm exec concurrently`
- **AND** `concurrently` is resolved from the exact root devDependency and committed root lockfile, without `pnpm dlx`

### Requirement: Package lockfiles remain in place and the root tool is locked

Existing package lockfiles SHALL remain in their respective packages. The orchestrator SHALL NOT move `apps/web/pnpm-lock.yaml` or any package's `uv.lock` (`apps/api`, `tools/update-gfw-tmf`) to the repo root and SHALL NOT introduce a pnpm workspace. Because the root declares `concurrently`, it SHALL also commit a root `pnpm-lock.yaml` limited to the root orchestrator project.

#### Scenario: Lockfiles stay in place

- **WHEN** the root orchestrator is added
- **THEN** `apps/web/pnpm-lock.yaml` and each Python package's `uv.lock` remain in their package directories
- **AND** the root `pnpm-lock.yaml` resolves the root `concurrently` devDependency reproducibly
- **AND** no `pnpm-workspace.yaml` is present at the repo root
