## 0. Cleanup

- [x] 0.1 Delete the Next.js build output committed by mistake in `f29eb93`: the five files under `monbo-front/monbo-front/.next/dev/static/chunks/` (`git rm -r monbo-front/monbo-front`), in a separate `chore` commit. `monbo-front/.gitignore` already ignores `.next/` anywhere in the tree, so no ignore rule changes. Check that `git ls-files | grep '\.next/'` comes back empty

## 1. Country state and shared actions

- [x] 1.1 Add `numericCode` (ISO 3166-1 numeric, as used by `world-atlas`) to every entry in `utils/countries.ts`, plus a `getCountryByNumericCode` helper
- [x] 1.2 Add `selectedCountry`, `setSelectedCountry` and `countryHydrated` to `DataContext`, persisted in `sessionStorage` under `monbo.selectedCountry`. On load, remove the `localStorage` key `deforestationAnalysis.selectedCountries`
- [x] 1.3 Add `useAvailableCountries()`, which returns the unique `availableCountriesCodes` of `availableMaps` with translated names and a loading flag. Clear a stored `selectedCountry` that is not in that set once the first fetch finishes
- [x] 1.4 Add a `resetAnalysis()` action to `DataContext` (farms, validation results, analysis results, analysis and report params back to their initial values). Replace the inline resets in `PolygonValidationModuleCard` and `DeforestationModuleCard` with it
- [x] 1.5 Add `useCountryChange()` exposing `requestCountryChange(code)` and the state of the restart modal, following design D4. Add a `RestartAnalysisModal` built on `ActionModal`

## 2. Routes and navigation

- [x] 2.1 Move the current home page to `src/app/[locale]/home/page.tsx` unchanged
- [x] 2.2 Point the home targets to `/home`: `HeaderButton path`, the header logo `Link`, `useModuleRouter`, `NavigateHomepageWhenEmptyData`, and `ValidFarmsTable`'s `router.push("/")`
- [x] 2.3 Make `HeaderButton` hide the module buttons on both `/` and `/home`
- [x] 2.4 Add a `RequireCountry` client guard that waits for `countryHydrated` and redirects to `/` when there is no country. Use it in the `/home`, `/polygons-validation/**`, `/deforestation-analysis/**` and `/report-generation/**` pages (not under `/admin`)

## 3. Landing page

- [x] 3.1 Add `d3-geo`, `topojson-client`, `world-atlas` and their `@types` to `monbo-front`
- [x] 3.2 Build a `CountryMap` component: lazy-load `countries-110m`, project with `d3-geo` fitted to the available countries' bounds, and draw highlighted, hoverable, clickable paths with a tooltip for available countries and neutral inert paths for the rest (mouse only; the SVG is `role="img"` and keyboard users use the list, design D5)
- [x] 3.3 Build a list of available countries (buttons, translated names) next to the map
- [x] 3.4 Add `NEXT_PUBLIC_CONTACT_URL` to `config/env.ts` with the `__NEXT_PUBLIC_CONTACT_URL__` placeholder, to `entrypoint.sh`, to the `.env*` templates and to the frontend variables in `azure/deploy.sh`
- [x] 3.5 Compose the landing in `src/app/[locale]/page.tsx`: title, subtitle, map, list, a loading state while layers load, and the contact button (hidden when the URL is unset). Selection calls `requestCountryChange` and navigates to `/home`
- [x] 3.6 Add the landing, contact button, header selector and restart modal texts to the en/es locale files

## 4. Header country selector

- [x] 4.1 Build a `CountryMenu` client component that shows the selected country name and a list of available countries. Every change goes through `requestCountryChange`. Hide it on `/` and when no country is selected
- [x] 4.2 Render `CountryMenu` in `Header` to the left of `LanguageMenu`

## 5. Remove the country multi-select

- [x] 5.1 Replace `useCountryAndMapsSelection` with `useMapsForSelectedCountry` (layers whose `availableCountriesCodes` include `selectedCountry`, plus the selected options, with no country state of its own)
- [x] 5.2 Remove the `MultiSelector` and the "no countries selected" message from `DeforestationModal`, and keep the "no maps available" message
- [x] 5.3 Do the same in `DeforestationAnalysisUploadDataPageContent`
- [x] 5.4 Update `MapSelectionModal` to the renamed hook. Delete the unused translation keys for the country selector

## 6. Upload without a country column

- [x] 6.1 In `utils/excel.ts`, drop `country` from the header aliases, from `mandatoryHeaders` and from the ISO validation
- [x] 6.2 In both upload pages (polygon validation and deforestation), add `country: selectedCountry` to every row before `generateFarmsData`
- [x] 6.3 Regenerate `public/files/m1-upload-file-template-{en,es}.xlsx` without the country column, keeping the other columns, their order and their formatting
- [x] 6.4 Update `docs/excel_integration` and `docs/onboarding.md`: no country column, and the new country-first flow
- [x] 6.5 Drop the country column from `monbo-api/tests/regression/regression_farms.xlsx` and set a pinned country on every row in `tests/regression/pipeline.py`, like the frontend (`test_excel_is_still_a_valid_upload_file` compares its headers with the template)

## 7. Verification

- [x] 7.1 `pnpm lint` and `pnpm build` pass in `monbo-front`. The API tests, ruff and black are green
- [x] 7.2 Manual QA in es and en, with a screenshot of each step: landing with CO/EC/CR highlighted → pick Colombia → `/home` → upload the new template → validation → change to Ecuador in the header (polygons kept, layers cleared) → analysis → try to change the country (cancel keeps everything; accept resets and shows `/home`)
- [x] 7.3 Manual QA of the edge cases: new tab on a deep link redirects to `/`, reload keeps the country, an old template with a country column is accepted, the contact button is hidden without the variable, the landing after an analysis opens the restart modal, `/admin` works without a country
