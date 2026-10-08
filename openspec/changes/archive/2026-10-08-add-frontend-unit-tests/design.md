## Context

`apps/web` is a Next.js 16 / React 19 / TypeScript 6 app (MUI 7, Emotion, i18next) with no tests. Its CI job ("Type-check, lint, build", a required check in the `dev` and `main` rulesets, renamed by this change) runs `tsc --noEmit`, ESLint and `next build`. The API has pytest with a regression suite that already reads the web's upload template (`apps/web/public/files/m1-upload-file-template-es.xlsx`).

Facts that shape the design:

- `tsconfig.json` includes `**/*.ts` and `**/*.tsx`, so every test file is type-checked by CI's `tsc --noEmit` and by `next build`, also in `Dockerfile.prod`, which installs devDependencies.
- **Module-level state lives outside React.**
  - `config/runtime.ts` holds the config loaded from `GET /config`. Its getters throw until it is set.
  - `context/DataContext.tsx` holds `keptState`, `flowGeneration` and the selected-country store. That matters only to the providers, which are out of scope here.
- **The group-A hooks read `DataContext` through `useContext`.** A test can render them under `<DataContext.Provider value={…}>` without the real `DataProvider`, which polls `/countries` and `/maps`. A few of them also call `next/navigation` (`useRouter`, `useSearchParams`) or `react-i18next` (`i18n.language`).
- **The formatting helpers take the language as an argument and read thresholds synchronously** through `getDeforestationThreshold()` and `getOverlapThreshold()`.
- **`excel.readExcel` reads with `FileReader` into `XLSX.read`.** `loadExcelFileFarmsData` takes the header from row 2 and drops row 3, the example row.
- **The API sends deforestation and overlap as unrounded fractions (0–1).** The thresholds are percentages (0–100). Rounding happens only at display time in the web.

## Goals / Non-Goals

**Goals:**

- A fast, deterministic unit-test suite that runs in CI inside the existing required job.
- Coverage of the pure logic, the upload templates, translation parity, and the hooks that only read `DataContext`.
- Fix the two threshold-formatting bugs, with tests that pin the corrected behavior.
- Helpers that the follow-up change (the providers) can reuse.

**Non-Goals:**

- End-to-end or visual tests, component rendering tests, coverage gates.
- `DataProvider`, `AdminSessionProvider`, `ReportProvider`, `workers/*`, `uploadLayerRaster`. They go in the next change.
- Changing what "deforestation-free" means, or the PDF's percentage formatting.
- Unblocking the demoted `react-hooks` ESLint rules. This change only makes that possible.

## Decisions

### D1: Vitest, not Jest

Vitest runs ESM and TypeScript natively, which matters for this dependency set: `i18next` 26, `date-fns` 4, `p-limit` 7 and `next-i18n-router` ship ESM. It reads the `@/` alias from `tsconfig.json` natively (Vite 8's `resolve.tsconfigPaths`), so no plugin is needed. It is also Next's documented option for unit tests.

Jest with `next/jest` was considered. It needs SWC transforms and `transformIgnorePatterns` for ESM-only packages, which is more configuration to maintain for no gain here.

### D2: jsdom as the single environment

The hooks need a DOM, and `readExcel` needs `FileReader`, `File` and `Blob`. One environment for the whole suite keeps the setup simple. The pure-logic tests pay a small startup cost for it.

happy-dom is faster but has a less complete `FileReader` and `Blob`. Splitting environments per file with `// @vitest-environment` was considered and left until the suite is large enough to need it.

`Intl` with full ICU comes from Node 24 (the version `engines` pins). `es-CL` and `en-US` percentages therefore format the same as in the browser.

### D3: Test layout and type-checking

- **Tests sit next to their code** as `src/**/*.test.ts(x)`.
- **Shared code lives in `src/test/`:** the setup file and the helpers.
- **`vitest.config.mts` sits at the root of `apps/web`.** It is `.mts` because `apps/web` is CommonJS and Vite warns about an ESM `.ts` config. Its `include` is limited to `src/**/*.test.{ts,tsx}`, and it sets `NEXT_PUBLIC_API_URL` through `test.env`.
- **Tests import `describe`, `it`, `expect` and `vi` from `vitest` explicitly.** No `globals: true`, and no `vitest/globals` in `tsconfig` `types`. `tsc` and ESLint then need no extra configuration, and an IDE always knows where a symbol comes from.
- **Test files stay inside the `tsconfig` include.** CI therefore type-checks them, and so does `next build`. That is cheap and catches stale tests after a refactor. `next build` and the Docker image don't bundle them, because nothing imports them.

### D4: Boundaries: what is mocked, and where

`src/test/setup.ts` is registered as `setupFiles`.

- **`next/navigation`:** `vi.mock` with a shared router whose `push` and `replace` are spies. It also provides a controllable `useSearchParams` and `useParams`. Helpers let a test set the search params and read the router's calls. Every test starts with fresh spies (`vi.clearAllMocks` in `afterEach`).
- **`fetch`:** stubbed globally to reject with `Unexpected request: <url>`. A test that needs a response stubs it. In this change, tests mock `@/api/*` modules with `vi.mock` in the test file that needs them. No group-A hook calls the API, so this is mostly a safety net.
- **`file-saver`:** `saveAs` is a spy.
- **Translations are not mocked.** `src/test/i18n.ts` builds a real instance with the app's `initTranslations` and the real JSON resources, per locale. Tests then assert the actual text users see, and a renamed key fails a test.
- **Environment:** `NEXT_PUBLIC_API_URL=http://api.test` is set through Vitest's `test.env`, before any app module is imported. URLs in assertions are then readable instead of `__NEXT_PUBLIC_API_URL__/…`.

The alternative was a `t` that returns the key. It is simpler, but it hides missing keys, and the `validateData` messages interpolate translated header names that the tests should check.

### D5: Rendering hooks with a fake context

`src/test/renderWithData.tsx` exports:

- `makeDataContext(overrides)`: a complete `DataContextValue` with inert defaults. The `set*` functions are `vi.fn()`, `resetAnalysis` and `invalidateAnalysis` are spies, and there are no farms or results.
- `renderHookWithData(hook, { context, locale })`: `renderHook` from `@testing-library/react`, wrapped in `DataContext.Provider` and an `I18nextProvider` (the real instance from D4). It returns the hook result and the context, so a test can assert the setters were called.

`makeDataContext` is typed against `DataContextValue`, so adding a field to the context fails the type-check until the helper gets a default. That is the desired coupling.

Test data (farms, validation results, map results) is built by small factories in `src/test/factories.ts`, typed against the app's interfaces. Shapes are not copied by hand in each test.

### D6: Resetting the runtime config

`config/runtime.ts` gets `resetRuntimeConfig()`, which sets the module's config back to `null`. The setup file calls it in `afterEach`. A test that formats percentages calls `setRuntimeConfig({ overlapThresholdPercentage, deforestationThresholdPercentage })` in its own `beforeEach`.

`vi.resetModules()` plus a dynamic `import()` per test was considered. It doesn't touch production code, but every test becomes async and verbose. It also gives each test a new module graph, which breaks identity checks such as `instanceof MapLayerChangedError`. A one-line exported reset is the smaller cost. Its JSDoc says it exists for tests.

### D7: The threshold-formatting fix

The current behavior and the rules (a) and (b) were compared on real API values during exploration. Rule (b) was chosen: values above a threshold get `max(1, decimals(threshold))` decimals.

- **`decimals(threshold)`** is the number of decimal places of the threshold as configured. It is computed as the smallest `d` in 0..6 with `Number(threshold.toFixed(d)) === threshold`, and 6 if none matches. This avoids `String(t)` returning exponent notation for tiny values, and float noise such as `0.1 + 0.2`.
- **The below-threshold label** becomes `"< " + formatPercentage(threshold / 100, decimals(threshold), language)`. `formatPercentage` caps `maximumFractionDigits`, so float noise in `threshold / 100` (`0.07 / 100 = 0.0007000000000000001`) never shows.
- **What doesn't change:**
  - the `value === 0 → "0%"` shortcut, which is already what `Intl` produces in both languages;
  - the threshold-0 branch ("< 0,1%" / 1 decimal), which is already localized;
  - `isDeforestationAboveThreshold` and `isOverlapAboveThreshold`, so which values count as above stays the same.
- **The doc comment of `getDecimalPlacesForThreshold`** is corrected to say the threshold is in percent.

Rule (a) was rejected: one decimal more than the threshold shows "2,83%" with a 0.5% threshold, which adds noise. A rule that never rounds an above-threshold value down to the threshold (1.04% → "1%" with a 1% threshold) was left out of scope.

### D8: The upload-template tests

The tests read each template from `public/files/` with `fs.readFileSync` (resolved from the working directory, `apps/web`: jsdom replaces the global `URL`, which `fs` rejects) and wrap the bytes in the environment's `File`. jsdom's `FileReader` only reads jsdom's own `Blob` and `File`, not Node's.

- **Empty template:** `loadExcelFileFarmsData(file, t, locale, "CR")`, with the template's own locale, returns `{ data: [], errorMessages: [] }`.
- **Filled template:** the test opens the template with `xlsx`, writes one farm row at `A4` with `sheet_add_aoa` (using the template's own column order from row 2), writes the workbook to a buffer and loads it as above. It then asserts the mapped farm: producer, ISO production date, coordinates, and two documents. No error messages are expected.
- **Header coverage:** every non-empty header in row 2 must be recognized. This is checked through the parsed output: the filled row sets a distinct value in every column, and every one must appear under an attribute. Renaming a template column therefore fails the test, which mirrors the API's `test_excel_is_still_a_valid_upload_file`. A separate test renames a header in memory and asserts the attribute is no longer mapped.

CI's change detection already selects the web job when `apps/web/public/files/*` changes.

### D9: Translation parity

One test walks `src/locales/en/*.json` and the matching `es` file. It flattens nested keys to dotted paths and compares the sets. On failure it lists `namespace: key` for each side's extras, so the message tells the developer what to add. A namespace present in only one language also fails.

### D10: CI and scripts

- **`apps/web/package.json`:**
  - `"test": "vitest run"`;
  - `"test:watch": "vitest"` for local work.
- **Root `package.json`:** `"test": "uv run --directory apps/api pytest && pnpm --dir apps/web test"`. This matches how `lint` chains both packages, and the API suite runs first as today.
- **`.github/workflows/ci.yml`:** the web job gets a `Test` step running `pnpm test` after `Lint` and before `Build`. Build is the slowest step, so a test failure stops the job earlier. The change-detection rules don't change.
- **The job is renamed "Tests, type-check, lint, build"**, so the required check names what it gates. Keeping the old name was considered: it avoids touching the rulesets, but a check that runs tests without saying so misleads anyone reading a red PR. A required check is matched by name and the bypass list is empty, so the rename needs both rulesets updated in step with the merges (see Migration Plan). The procedure is documented in `docs/branch_protection.md` for future renames.
- **New devDependencies:** `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/dom`. No coverage package for now.
  - They are added with `pnpm add -D` and the lockfile is committed.
  - Exact versions are chosen at implementation time, compatible with TypeScript 6 and React 19.
  - Dependabot's existing npm config for `apps/web` covers them.

## Risks / Trade-offs

- **[Formatting tests depend on Node's ICU data.]** An ICU update could change percent spacing (e.g. "1,4 %" vs "1,4%"). → Node 24 is pinned in `engines` and CI. A change of that kind is user-visible anyway, and a failing test is how we'd want to learn about it.
- **[Real translations make hook tests sensitive to copy edits.]** → Hook tests assert keys' rendered text only where the text is the behavior (the validation messages). Elsewhere they assert data, not strings.
- **[The fake context can drift from the real provider's behavior.]** For example, the provider sorts `selectedMaps` by id and the fake doesn't. → The group-A tests cover only what each hook derives from its inputs. The provider's own behavior is the follow-up change's scope, where `DataProvider` is tested for real.
- **[Type-checking test files in `next build` couples the production build to test types.]** → It is the same check CI already runs, and test-only types come from devDependencies that the Docker build installs. If it ever becomes a problem, a `tsconfig` exclude for `next build` can be added.
- **[A visible change for environments with a threshold set.]** → It is limited to more decimals with a 1% threshold, and a comma instead of a dot in fractional Spanish labels. The CHANGELOG mentions it. With the default threshold of 0, nothing changes.

## Migration Plan

There is no data or deploy migration. The change ships in one PR into `dev`:

1. Toolchain, setup and helpers.
2. Tests. The tests for `numbers` are written against the corrected behavior, together with the fix.
3. The CI step, the job rename and the root script.
4. README, docs and CHANGELOG.

The job rename needs an admin, outside the repo:

- **`dev`:** when the PR is reviewed and its other checks are green, replace "Type-check, lint, build" with "Tests, type-check, lint, build" in the `dev` ruleset, then merge at once. Open PRs into `dev` are then updated from `dev` so they report the new name.
- **`main`:** the same, in the `main` ruleset, right before the release that carries this change merges. Hotfixes before that release still report the old name, which `main` still requires.

Rollback is a revert of the PR, plus restoring the old name in the `dev` ruleset (and `main`'s, if the release went out).

## Open Questions

None blocking. Two things are left for the follow-up change: whether a coverage report (non-gating) is worth adding once the providers are covered, and whether to split jsdom and node environments for speed.
