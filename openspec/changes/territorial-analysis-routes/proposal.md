## Why

Stage 2 is called "Análisis territorial" (decision D7 of undp/monbo#116) and crosses farms with layers of any category, but the web still names it after deforestation: the page lives at `/deforestation-analysis`, its i18n namespace is `deforestationAnalysis`, and generic pieces (the results table, the "no observations" counter, the visible-data hook, the results type and the `DataContext` state) carry the deforestation name. A reader can't tell the generic code from the code that really is about forest loss. This is the last unit of the orchestration (GC-13, undp/monbo#129): every other web unit is merged in `feat/layer-manager`, so the rename no longer conflicts with work in flight.

## What Changes

- **BREAKING (URLs):** stage 2 moves to `/territorial-analysis` and `/territorial-analysis/upload-data`, in both languages. The old URLs answer a permanent redirect (308) to the new ones, keeping the language prefix, any sub-path and the query string, so bookmarks, shared links and the example PDFs keep working.
- The i18n namespace `deforestationAnalysis` becomes `territorialAnalysis` (`locales/es/` and `locales/en/`), with every `t("…")`, `useTranslation` and namespace list updated. The `home:sameDataModal.deforestationAnalysis` key becomes `home:sameDataModal.territorialAnalysis`. Texts don't change.
- `components/page/deforestationAnalysis/` becomes `components/page/territorialAnalysis/`. Generic components, hooks, types, state and utilities are renamed (full table in `design.md`), for example `DeforestationResultsTable` → `LayerResultsTable`, `useVisibleDataForDeforestationPage` → `useVisibleDataForAnalysisPage`, `DeforestationAnalysisMapResults` → `LayerAnalysisMapResults` (D17), and `DataContext`'s `deforestationAnalysisParams`/`deforestationAnalysisResults` → `territorialAnalysisParams`/`territorialAnalysisResults`.
- Internal links (stage navigation, header "Análisis", landing, outdated-analysis guard, post-upload navigation) point to the new routes.
- Kept on purpose: the API routes and contract, the usage events and their `deforestation-analysis` module value (D12), the `X-Monbo-Module` header value, `DEFORESTATION_THRESHOLD_PERCENTAGE` and the satellite-image env variable (D12), the default category id `deforestation`, the legacy `localStorage` key `deforestationAnalysis.selectedCountries` that the app still cleans up, the upload templates in `public/files/`, and the i18n keys inside the namespace whose text is about forest loss.
- `docs/onboarding.md` and `apps/web/README.md` name the new routes, folder and namespace. `CHANGELOG.md` gets an Unreleased entry.

## Capabilities

### New Capabilities

- `web-routes`: the public URL of each flow stage, the permanent redirects from retired URLs, and the i18n namespace of each stage.

### Modified Capabilities

Each delta below changes only the stage 2 path from `/deforestation-analysis` to `/territorial-analysis`; the rest of each requirement is copied unchanged. Four of these capabilities exist only in changes that are merged in `feat/layer-manager` but not archived yet, so each delta is written on top of the latest version of the requirement, as `territorial-analysis-by-category` did with `analysis-flow-stages`. This change is archived after them.

- `country-selection`: "Module pages require a selected country" (on top of `new-landing`).
- `analysis-flow-stages`: "The flow is three stages with their own pages", "Stage pages name their stage" (from `progressive-flow-stages`), "Stage 2 is never blocked and stage 3 needs results" and "A next-stage card closes stages 1 and 2" (from `territorial-analysis-by-category`).
- `territorial-analysis`: "Direct entry without polygons" and "The analysis starts only when the user asks" (from `territorial-analysis-by-category`).
- `site-navigation`: "Header navigation links" (from `new-landing`).
- `landing-page`: "Three step cards" (from `new-landing`).

## Impact

- **Web:** `src/app/[locale]/territorial-analysis/` (moved), `src/proxy.tsx` and `src/proxy.test.ts` (redirects), `src/locales/{es,en}/territorialAnalysis.json` (moved), `src/utils/i18n.ts`, `src/test/i18n.ts`, every component, hook, util, context and test that imports the renamed modules or calls `t("deforestationAnalysis:…")`. About 100 files, almost all renames and import updates.
- **API:** none. No contract change, so `openapi.json` and `schema.d.ts` stay as they are.
- **Usage dashboard:** none. No event carries the page path; the module value stays `deforestation-analysis`.
- **Numbers:** none. No change to classification, the ratio or the report content.
- **Docs:** `docs/onboarding.md`, `apps/web/README.md`, `CHANGELOG.md`. `CLAUDE.md` only names the removed API routes, which stay as written.
