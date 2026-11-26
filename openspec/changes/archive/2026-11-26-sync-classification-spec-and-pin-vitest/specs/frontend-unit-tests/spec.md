## ADDED Requirements

### Requirement: The test runner is pinned

`apps/web/package.json` SHALL declare `vitest` at an exact version, the one `pnpm-lock.yaml`
resolves, with no range operator, as `CLAUDE.md` requires for dependencies.

#### Scenario: Frozen install with the pinned runner

- **WHEN** `pnpm install --frozen-lockfile` runs in `apps/web`
- **THEN** it succeeds without changing `pnpm-lock.yaml`, and the lockfile's importer declares
  the same exact `vitest` version as `package.json`

### Requirement: The result colours are covered

The suite SHALL pin, for each result class, the colour and the background that
`utils/styling` gives it (the ones the PDF report and the result chips paint with): `ok` the
palette's `ok` pair, `flagged` its `flagged` pair, and `unknown` its `unknown` pair. It SHALL
also cover that a `null` rule or a `null` value is painted as `unknown`.

#### Scenario: Colours per class

- **WHEN** the colour tests run
- **THEN** `ok` is painted with the `ok` colour and background and `flagged` with the
  `flagged` ones, never swapped, and a result with a `null` rule with the `unknown` ones
