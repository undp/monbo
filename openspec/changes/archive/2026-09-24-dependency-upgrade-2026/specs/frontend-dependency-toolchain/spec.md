## ADDED Requirements

### Requirement: pnpm-managed frontend with pinned toolchain

The `monbo-front` package SHALL continue to use pnpm with a committed `pnpm-lock.yaml`. It SHALL declare an `engines` field and an exact `packageManager` field pinning the supported Node and pnpm versions. CI and both frontend Dockerfiles SHALL use that pnpm version through Corepack and SHALL install reproducibly with `pnpm install --frozen-lockfile`; Dockerfiles SHALL NOT install a mutable global pnpm.

#### Scenario: Frozen install from committed lockfile

- **WHEN** the frontend is installed in CI or Docker
- **THEN** `pnpm install --frozen-lockfile` succeeds without modifying `pnpm-lock.yaml`

#### Scenario: Docker uses the pinned pnpm toolchain

- **WHEN** either frontend Dockerfile installs JavaScript dependencies
- **THEN** Corepack activates the exact pnpm version declared by `packageManager`
- **AND** no unversioned or mutable global pnpm installation is performed

#### Scenario: Node and pnpm versions pinned

- **WHEN** `monbo-front/package.json` is inspected
- **THEN** `engines` and `packageManager` declare the supported Node 24 and pnpm versions

### Requirement: Node 24 LTS runtime baseline

The frontend SHALL target Node 24 LTS — the active LTS line, whose maintenance window runs to 2028-04-30. Both frontend Dockerfiles SHALL use `node:24-alpine`, replacing the end-of-life Node 20 base image. The frontend CI workflow SHALL pin `actions/setup-node` to the same major, so the runtime the application is validated on is the runtime it ships on. Node 22 SHALL NOT be the final target: it left active LTS on 2025-10-21 and reaches end of life on 2027-04-30, within a year of this change completing.

#### Scenario: Docker images run on Node 24

- **WHEN** either frontend image is built
- **THEN** the base image is `node:24-alpine`

#### Scenario: CI validates on the shipping runtime

- **WHEN** the frontend workflow runs after the runtime baseline is established
- **THEN** `actions/setup-node` selects the same Node major as the Dockerfiles and the `engines` floor

### Requirement: Next 16 build and lint behavior

The frontend SHALL build on Next 16. Because `next lint` is removed in Next 16, the lint script SHALL invoke `eslint .` directly. The dev script SHALL NOT pass the removed `--turbo` flag (Turbopack is the default), and a webpack fallback (`next build --webpack`) SHALL remain available. Standalone output and MUI server-side style rendering SHALL keep working.

#### Scenario: Lint runs via eslint directly

- **WHEN** the frontend lint script is executed
- **THEN** it runs `eslint .` and does not invoke the removed `next lint` command

#### Scenario: Standalone build serves correctly

- **WHEN** the frontend is built with `output: "standalone"` and started via `start:standalone`
- **THEN** the app serves pages with MUI styles correctly applied during SSR

#### Scenario: Dev server uses default Turbopack

- **WHEN** the dev script starts the Next server
- **THEN** it starts without the removed `--turbo` flag

### Requirement: Current frontend dependency set with satisfied peers

Frontend dependencies SHALL be upgraded to their target versions with all peer-dependency constraints satisfied. Coupled upgrades SHALL be applied together in a single commit: React and its `@types/react`(-dom), and i18next 26 with react-i18next 17 (which requires i18next >= 26.2). TypeScript SHALL be raised to 6.0.3 — the head of the v6 line — and eslint to 10 (requiring Node 20.19 / 22.13 / 24+). TypeScript SHALL NOT be raised to 7.x while `typescript-eslint`, on which `eslint-config-next` depends, caps its `typescript` peer below 6.1, since that would break the blocking lint step. `@types/node` SHALL be aligned to the real Node 24 runtime, not a higher major.

#### Scenario: TypeScript stays within the lintable range

- **WHEN** the TypeScript version is selected for the toolchain upgrade
- **THEN** it satisfies the `typescript` peer range declared by the `typescript-eslint` version that `eslint-config-next` depends on
- **AND** `eslint .` runs without an unsupported-TypeScript-version failure

#### Scenario: Coupled type/runtime upgrades stay consistent

- **WHEN** React or i18next is upgraded
- **THEN** its matching `@types/*` and peer packages are upgraded in the same commit so type-checking and peer resolution succeed

#### Scenario: Type-check passes on upgraded toolchain

- **WHEN** `tsc --noEmit` runs after the TypeScript 6.0.3 / eslint 10 upgrade
- **THEN** it completes with no type errors, including the i18next `TFunction`-typed files

### Requirement: MUI 7 migration

Material UI SHALL be upgraded from v6 to the head of the v7 line using the official codemod. `Grid2` usages SHALL be migrated to `Grid`, and the App Router integration import SHALL move from `@mui/material-nextjs/v15-appRouter` to the v16 path. A visual review checklist SHALL be completed. (MUI v8 does not exist; v9 is explicitly deferred.)

#### Scenario: Grid and App Router imports migrated

- **WHEN** the MUI 7 upgrade is applied
- **THEN** `Grid2` is replaced by `Grid` in the affected pages and the `@mui/material-nextjs` import uses the v16 App Router path

#### Scenario: Visual review completed

- **WHEN** the MUI 7 upgrade is proposed for merge
- **THEN** the visual review checklist has been completed against the affected screens
