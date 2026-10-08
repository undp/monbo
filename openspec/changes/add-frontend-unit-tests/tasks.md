## 1. Toolchain

- [x] 1.1 Add the devDependencies to `apps/web` with `pnpm add -D`: `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/dom` (no `vite-tsconfig-paths`: Vite 8 resolves `tsconfig` paths natively with `resolve.tsconfigPaths`). Pick versions compatible with TypeScript 6, React 19 and Node 24, and commit `pnpm-lock.yaml`
- [x] 1.2 Create `apps/web/vitest.config.mts` (`.mts`: `apps/web` is CommonJS and Vite warns about an ESM `.ts` config): jsdom environment, `resolve.tsconfigPaths`, `include: ["src/**/*.test.{ts,tsx}"]`, `setupFiles: ["src/test/setup.ts"]`, no globals (D2, D3)
- [x] 1.3 Add the `test` (`vitest run`) and `test:watch` (`vitest`) scripts to `apps/web/package.json`
- [x] 1.4 Change the root `package.json` `test` script to run pytest and then `pnpm --dir apps/web test` (D10)
- [x] 1.5 Check that `pnpm exec tsc --noEmit`, `pnpm run lint` and `pnpm run build` still pass in `apps/web` with the config file and an empty suite

## 2. Shared setup and helpers

- [x] 2.1 Add `resetRuntimeConfig()` to `src/config/runtime.ts`, with a JSDoc saying it exists for tests (D6)
- [x] 2.2 Create `src/test/setup.ts` (D4):
  - set `NEXT_PUBLIC_API_URL=http://api.test`;
  - stub `fetch` to reject with `Unexpected request: <url>`;
  - mock `next/navigation` with a shared router spy and controllable `useSearchParams` and `useParams`;
  - mock `file-saver`;
  - in `afterEach`: `resetRuntimeConfig()`, `vi.clearAllMocks()` and reset the search params
- [x] 2.3 Create `src/test/navigation.ts`, the helpers to read the router's calls and set the search params
- [x] 2.4 Create `src/test/i18n.ts`, which builds a real i18n instance per locale with `initTranslations` and every namespace (D4)
- [x] 2.5 Create `src/test/factories.ts`, with typed factories for `FarmData`, validation results (`farmResults` with status), `MapData` and `DeforestationAnalysisMapResults` (D5)
- [x] 2.6 Create `src/test/renderWithData.tsx` with `makeDataContext(overrides)`, typed against `DataContextValue` with spy setters, and `renderHookWithData(hook, { context, locale })`, which wraps the hook in `DataContext.Provider` and `I18nextProvider` (D5)
- [x] 2.7 Add sanity tests for the setup:
  - an unstubbed `fetch` fails with the URL;
  - reading a threshold after the reset throws "read before GET /config loaded";
  - the router spy records a `push`

## 3. Fix the threshold formatting

- [x] 3.1 Write `src/utils/numbers.test.ts` first, against the corrected behavior. It covers every scenario of the `product-configuration` delta spec in `es` and `en`:
  - threshold 0: `0`, below 0.1%, 1 decimal;
  - threshold 1: 1.4% → "1,4%", 0.4% → "< 1%";
  - threshold 0.25: 2.8333% → "2,83%";
  - threshold 2: 10.4999% → "10,5%";
  - overlap with threshold 0.5: 0.33% → "< 0,5%" / "< 0.5%".

  Also cover `formatNumber` and `formatPercentage`. Confirm the new cases fail on the current code
- [x] 3.2 In `src/utils/numbers.ts`, replace `getDecimalPlacesForThreshold` with `max(1, decimals(threshold))`, where `decimals` is the smallest `d` in 0..6 with `Number(t.toFixed(d)) === t`. Correct its doc comment: the threshold is in percent (D7)
- [x] 3.3 Format the below-threshold label of `formatDeforestationPercentage` and `formatOverlapPercentage` with `formatPercentage(threshold / 100, decimals(threshold), language)` (D7)
- [x] 3.4 Run the `numbers` tests until they pass. Check that `isDeforestationAboveThreshold`, `isOverlapAboveThreshold` and the PDF's `sections.tsx` are untouched

## 4. Pure-logic tests

- [x] 4.1 `src/utils/deforestation.test.ts`: above and at-threshold edges for deforestation and overlap, including threshold 0
- [x] 4.2 `src/utils/polygons.test.ts`:
  - `parsePolygonArea` around the 5000 m² switch, in `es` and `en`;
  - `parseAreaToHectares` with and without the unit;
  - `parseLatitude` and `parseLongitude` hemispheres
- [x] 4.3 `src/utils/strings.test.ts` and `src/utils/dates.test.ts`:
  - `removeDiacritics`;
  - `getCommaSeparatedUniqueTexts` (null, undefined, duplicates, sorting);
  - the short and long date formats per language. Use fixed dates that don't depend on the timezone
- [x] 4.4 `src/utils/layerLabel.test.ts`, covering the labels it builds from a map's fields
- [x] 4.5 `src/utils/geojson.test.ts`:
  - the feature built for a point farm and for a polygon farm;
  - the analysis export's per-map deforestation property, formatted through `formatDeforestationPercentage` with a loaded config
- [x] 4.6 `src/utils/excel.test.ts` for `validateData`, with the real `t` in `es` and `en`:
  - a missing mandatory field reports the header name and row 4;
  - an invalid coordinates format;
  - an invalid geometry type;
  - invalid WKT;
  - an invalid GeoJSON point and polygon;
  - a valid row returns no errors

## 5. Upload templates and translations

- [x] 5.1 Add a helper that loads a file from `public/files/` into the environment's `File` (D8)
- [x] 5.2 `src/utils/excelTemplates.test.ts`: each unmodified template (`en`, `es`) returns no farms and no errors through `loadExcelFileFarmsData`, with a selected country
- [x] 5.3 In the same file, fill each template with one farm row at `A4`, with a distinct value in every column and two documents. Assert the mapped farm: producer, ISO production date, coordinates, documents, and every column recognized. No errors are expected
- [x] 5.4 Add a test that renames a header in the in-memory workbook and asserts the attribute is no longer mapped (a permanent test instead of a manual check)
- [x] 5.5 `src/locales/locales.test.ts`: for every namespace, flatten the keys of `en` and `es` and assert equal sets. A failure lists `namespace: key` per side. A namespace in only one language also fails (D9)

## 6. Hook tests (group A)

- [x] 6.1 `useVisibleDataForDeforestationPage`:
  - `polygonsSubset` `"valid"` hides `NOT_VALID` farms and their results;
  - `"all"` and `null` keep every farm;
  - results are filtered by the selected maps, and `version` is kept;
  - no results returns empty lists
- [x] 6.2 `useValidFarmsDataForValidationPage` and `useDeforestationFreeResultsCountByMap`. The count is `null` when every value is `null`, and otherwise counts the zeros (current logic, kept)
- [x] 6.3 `useCountryChange`:
  - the same country only navigates;
  - before an analysis, the change applies at once: maps cleared, farms and report farms get the new country, the country is set, optional navigation;
  - after an analysis the country is pending, `confirmRestart` resets, sets the country and pushes `/home`, and `cancelRestart` clears the pending country
- [x] 6.4 `useModuleRouter`:
  - no path does nothing;
  - `/` and `/home` go there directly;
  - a module path without farms goes to `<path>/upload-data`, and with farms to `<path>`;
  - the hook uses the latest farms after a rerender
- [x] 6.5 `useMapsForSelectedCountry`, `useAvailableCountries` and `useSelectedMap`:
  - `useAvailableCountries` sorts country names per language and computes the loading and error states;
  - `useSelectedMap` follows the `selectedMap` search param, falls back to the first map, and returns the empty shape when no maps are selected
- [x] 6.6 `useSearch`:
  - an empty query returns the list;
  - a fuzzy match;
  - accents according to the options passed

  `useSortedTable` cycles asc → desc → none, and a new column restarts at asc

## 7. CI and documentation

- [x] 7.1 In `.github/workflows/ci.yml`, add a `Test` step (`pnpm test`) to the web job, after `Lint` and before `Build`. Update the workflow's step comments if needed
- [x] 7.1a Rename the web job "Tests, type-check, lint, build" and update every live reference (workflow comment, `docs/branch_protection.md` tables and ruleset JSON, `apps/web/README.md`, the `pr-review` skill, CHANGELOG). Document the rename procedure in `docs/branch_protection.md` ("Renaming a required check"). Leave the archived changes as they are
- [x] 7.2 Replace "There are no tests for this project yet" in `apps/web/README.md` with a Testing section:
  - how to run the suite (`pnpm test`, `pnpm test:watch`, root `pnpm test`);
  - where tests and helpers live;
  - what is mocked;
  - the runtime-config reset
- [x] 7.3 Check `docs/` (onboarding, architecture, branch protection) for any statement that the web has no tests or listing the web job's steps, and update it
- [x] 7.4 Add CHANGELOG entries under `[Unreleased]`:
  - Added: web unit tests and CI step;
  - Fixed: threshold percentages show at least one decimal (1% threshold) and the below-threshold label is localized

## 8. Verification

- [x] 8.1 Run `pnpm test`, `pnpm exec tsc --noEmit`, `pnpm run lint` and `pnpm run build` in `apps/web`, and `pnpm test` at the root. All pass
- [x] 8.2 Run the suite twice in random order (`vitest run --sequence.shuffle`) to confirm there is no order dependence
- [x] 8.3 Run `openspec validate add-frontend-unit-tests --strict` and fix any finding
