## MODIFIED Requirements

### Requirement: pnpm-managed frontend with pinned toolchain

The `monbo-front` package, in `apps/web`, SHALL continue to use pnpm with a committed `pnpm-lock.yaml`. It SHALL declare an `engines` field and an exact `packageManager` field pinning the supported Node and pnpm versions. CI and both frontend Dockerfiles SHALL use that pnpm version through Corepack and SHALL install reproducibly with `pnpm install --frozen-lockfile`; Dockerfiles SHALL NOT install a mutable global pnpm.

#### Scenario: Frozen install from committed lockfile

- **WHEN** the frontend is installed in CI or Docker
- **THEN** `pnpm install --frozen-lockfile` succeeds without modifying `pnpm-lock.yaml`

#### Scenario: Docker uses the pinned pnpm toolchain

- **WHEN** either frontend Dockerfile installs JavaScript dependencies
- **THEN** Corepack activates the exact pnpm version declared by `packageManager`
- **AND** no unversioned or mutable global pnpm installation is performed

#### Scenario: Node and pnpm versions pinned

- **WHEN** `apps/web/package.json` is inspected
- **THEN** `engines` and `packageManager` declare the supported Node 24 and pnpm versions
