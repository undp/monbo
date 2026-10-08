## Why

The web app has no automated tests. `apps/web/README.md` says so ("There are no tests for this project yet"), and its CI job only type-checks, lints and builds. That has two costs today:

- **Bugs in the domain logic go unnoticed.** Exploring this change surfaced two in the threshold formatting (`src/utils/numbers.ts`), used by the result tables, the maps and the Excel/GeoJSON downloads:
  - **Decimal places.** `getDecimalPlacesForThreshold` receives the threshold in percent (0–100, from `GET /config`) and computes `ceil(|log10(t)|)`. Its comment promises one extra place that the code never adds. With a threshold of exactly 1% it returns 0 decimals: 1.4% shows as "1%", 2.83% as "3%", 10.5% as "10%". A 1% threshold makes the app *less* precise than no threshold or a 2% threshold (1 decimal each).
  - **Localization.** The below-threshold label is built as `` `< ${threshold}%` ``, outside `Intl`. In Spanish a 0.5% threshold shows as "< 0.5%", while every other number in the app reads "1,4%".
- **Refactors are blocked.** `eslint.config.mjs` demotes three `react-hooks` rules to `warn` because fixing them "means refactoring component logic with no automated test coverage behind it". The Dependabot PRs for MUI, Next or `xlsx` are also only checked by the build.

The API already has pytest with a regression suite and a numeric baseline. This change gives the web a comparable first layer: pure logic and the hooks that read `DataContext`. It leaves end-to-end tests and the context providers for later.

## What Changes

- **A unit-test toolchain for `apps/web`.**
  - Vitest with jsdom and `@testing-library/react`.
  - One shared setup that mocks the app's boundaries (`next/navigation`, `file-saver`) and fails any network request a test didn't stub. Translations are the real `en`/`es` files, not a mock.
  - Test files are type-checked by the existing `tsc --noEmit`.
  - A `test` script in `apps/web`. The root `pnpm test` runs the API and web suites, like `lint`.
- **CI runs the web tests.** A `pnpm test` step goes inside the existing web job, renamed from "Type-check, lint, build" to "Tests, type-check, lint, build" so the check says what it gates. It is a required check, so the `dev` and `main` rulesets switch to the new name in step with the merges (see Impact).
- **Tests for the pure logic.**
  - Formatting: `numbers`, `polygons`, `strings`, `dates`.
  - Domain helpers: `deforestation`, `layerLabel`, `geojson`.
  - The upload validation (`excel.validateData`).
  - `loadExcelFileFarmsData` read against the real upload templates (`public/files/m1-upload-file-template-{en,es}.xlsx`), the same files the API regression suite reads.
- **A translation-parity test.** The `en` and `es` namespaces must keep the same keys. They match today.
- **Tests for the hooks that only read `DataContext`.** These are rendered with an injected context value, not the real provider:
  - `useVisibleDataForDeforestationPage`, `useValidFarmsDataForValidationPage`, `useDeforestationFreeResultsCountByMap`;
  - `useCountryChange`, `useModuleRouter`;
  - `useMapsForSelectedCountry`, `useAvailableCountries`, `useSelectedMap`;
  - `useSearch`, `useSortedTable`.
- **Fix the two threshold-formatting bugs.**
  - Values above a threshold show `max(1, decimal places of the threshold)` decimals: 1% → 1, 0.5% → 1, 0.25% → 2, 0.05% → 2.
  - The "< X%" label is formatted with the user's locale.
  - This applies to both deforestation and overlap. The PDF report formats its own percentages and does not change.
- **`config/runtime.ts` gets a reset** so each test starts without a loaded config.

Out of scope:

- End-to-end tests.
- The context providers (`DataProvider`, `AdminSessionProvider`, `ReportProvider`) and `workers/reportPdfClient`. These go in a follow-up change.
- The PDF rendering code, `uploadLayerRaster` (XHR) and UI components.
- What counts as "deforestation-free". The map, the counter, the table and the PDF disagree when a threshold is set; the current behavior is kept as is.
- A value just above the threshold that rounds to it (1.04% with a 1% threshold shows "1%").

## Capabilities

### New Capabilities

- `frontend-unit-tests`: the web's unit-test suite, covering:
  - its toolchain and how it runs;
  - what it covers (pure logic, the upload templates, translation parity, the hooks that read `DataContext`);
  - how tests isolate module state and mock the app's boundaries.

### Modified Capabilities

- `continuous-integration`: the "Frontend CI pipeline" requirement adds the unit tests to the steps that gate a pull request and renames the job. The required-checks and change-detection requirements use the new name, and renaming a required check gets a documented procedure.
- `api-contracts`: "Contracts can't go stale" names the renamed frontend check.
- `product-configuration`: a new requirement states how a threshold-dependent percentage is displayed: its decimal places, and a locale-formatted "< X%" label. The existing requirements don't change, and their "< 1%" scenario still holds.

## Impact

- **Web:**
  - `package.json` and its lockfile: new devDependencies (`vitest`, `jsdom`, `@testing-library/react`, `@testing-library/dom`) and the `test` and `test:watch` scripts;
  - new `vitest.config.mts`, a setup file and test helpers;
  - colocated `*.test.ts(x)` files;
  - `src/utils/numbers.ts` (the fix);
  - `src/config/runtime.ts` (reset for tests);
  - `README.md` (Testing section).
- **Docs:** the root `README.md`, `docs/onboarding.md` and `CHANGELOG.md`.
- **Root:** `package.json`'s `test` script also runs the web tests.
- **CI:** `.github/workflows/ci.yml` gets a test step in the web job, and the job is renamed "Tests, type-check, lint, build".
- **Rulesets (admin action, outside the repo):** the `dev` ruleset must require the new name right before this change merges into `dev`, and `main`'s right before the release that carries it merges into `main`. Until then, this PR waits for the old check name. The procedure is in `docs/branch_protection.md`.
- **Users:** with a threshold configured, above-threshold percentages may show one more decimal (always with a 1% threshold), and in Spanish a fractional threshold reads "< 0,5%". This is visible in the tables, the map, the overlap table and the Excel/GeoJSON downloads. With the default threshold of 0, nothing changes.
- **API:** none.
