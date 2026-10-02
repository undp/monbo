## Why

The country is chosen late in the flow: in the deforestation modal of the polygon validation page (a multi-select next to the layer checkboxes) and again on the deforestation upload page. Users upload and validate polygons before they know which layers exist for their country, and the upload template forces a `country` column on every row even though every analysis only uses the layers of one country. The team wants the country to be the first decision: picked on an interactive map that only offers countries with layers (today Colombia, Ecuador and Costa Rica), and then fixed for the analysis.

## What Changes

- New **landing page at `/`** with an interactive world map. Countries that have at least one available layer are highlighted and are the only ones that can be selected. A list of the same countries sits next to the map for keyboard and small-screen use. A **"Contact us to add your country"** button links to `NEXT_PUBLIC_CONTACT_URL` and is hidden when that variable is unset.
- **BREAKING (routes)**: the current home page with the three module cards moves from `/` to **`/home`**. "Home" in the header, the logo, and every "back to home" redirect point to `/home`.
- The selected country becomes **app state** (one country, not a list), kept in `sessionStorage`. Module pages redirect to the landing when no country is selected.
- New **country selector in the header**, left of the language menu, that shows the selected country and lets the user change it:
  - Before a deforestation analysis exists, the change applies immediately. Uploaded and validated polygons are kept, and any selected layers are cleared.
  - After an analysis exists, a confirmation modal says the analysis must start over. Accepting resets all loaded data, applies the new country, and goes to `/home`. Cancelling keeps everything unchanged.
- **Remove the country multi-select** from the deforestation modal (polygon validation) and from the deforestation upload page. Both list only the layers of the selected country.
- **BREAKING (upload template)**: the `country` column is removed from the Excel template (en/es) and is no longer required. The frontend sets every farm's `country` to the selected country before calling `POST /farms/parse`. A `country` column in an older file is ignored. The API contract does not change.
- The multi-country `localStorage` key `deforestationAnalysis.selectedCountries` is no longer used and is removed on load.

## Capabilities

### New Capabilities
- `country-selection`: choosing the analysis country first. Covers the landing map (which countries are highlighted and selectable, the list fallback, the contact button), the `/` vs `/home` routes and the redirect when no country is selected, the selected-country state and its persistence, the header selector and its lock after an analysis (with the restart modal), layer lists restricted to the selected country, and the upload template without a `country` column.

### Modified Capabilities
<!-- None. The existing specs cover the API, storage, admin and tooling; none of their requirements change. -->

## Impact

- **Frontend (`monbo-front`)**:
  - New landing page `src/app/[locale]/page.tsx` (map + list + contact button) and `src/app/[locale]/home/page.tsx` (the current home content).
  - New dependencies for the SVG map: `d3-geo`, `topojson-client`, `world-atlas` (plus their `@types`).
  - `DataContext` gains `selectedCountry` and a shared "reset analysis" action. The existing reset in `PolygonValidationModuleCard` and `DeforestationModuleCard` is reused.
  - New header `CountryMenu` next to `LanguageMenu`. `HeaderButton`, `Header` (logo), `useModuleRouter`, `NavigateHomepageWhenEmptyData` and `ValidFarmsTable` change their `/` targets.
  - `DeforestationModal`, `DeforestationAnalysisUploadDataPageContent` and `useCountryAndMapsSelection` lose the country multi-select.
  - `utils/excel.ts` stops requiring `country`, both upload pages set it, and the templates `public/files/m1-upload-file-template-{en,es}.xlsx` are regenerated.
  - `utils/countries.ts` gains the ISO 3166-1 numeric code of each country, which is how `world-atlas` identifies them.
  - New translation keys (en/es) for the landing, header selector and restart modal.
  - `NEXT_PUBLIC_CONTACT_URL` in `config/env.ts`, `entrypoint.sh` (placeholder replacement), the `.env*` templates and `azure/deploy.sh`.
- **Repository cleanup**: remove the stray Next.js build output tracked under `monbo-front/monbo-front/.next/` (5 files, ~650 KB). It is already covered by `.gitignore`.
- **API (`monbo-api`)**: no application changes; `InputFarmData.country` stays required and validated. The regression suite mirrors the frontend: `regression_farms.xlsx` loses its country column (its test requires the template's headers) and `tests/regression/pipeline.py` sets one country on every row.
- **Docs**: `docs/excel_integration` and `docs/onboarding.md` stop describing the `country` column and describe the new flow.
