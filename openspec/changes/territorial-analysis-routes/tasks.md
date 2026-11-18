## 1. Redirects

- [x] 1.1 In `apps/web/src/proxy.tsx`, redirect `/deforestation-analysis` and every path below it, with or without `/es` or `/en`, to the same path under `/territorial-analysis` with a 308, before `i18nRouter`, keeping the requested prefix and the query string (design D1)
- [x] 1.2 In `apps/web/src/proxy.test.ts`, cover: no prefix, `/es`, `/en`, `upload-data`, trailing slash, query string kept, status 308, `/deforestation-analysis-old` not redirected, and `/territorial-analysis` rewritten by the locale router without a redirect

## 2. Routes and namespace

- [x] 2.1 `git mv` `app/[locale]/deforestation-analysis/` to `app/[locale]/territorial-analysis/`; rename the stage 2 page component to `TerritorialAnalysis` and the report page component to `ReportGeneration`
- [x] 2.2 `git mv` `locales/{es,en}/deforestationAnalysis.json` to `territorialAnalysis.json`; rename `deforestationMapFooter` to `mapFooter` and `home:sameDataModal.deforestationAnalysis` to `home:sameDataModal.territorialAnalysis` in both languages
- [x] 2.3 Update every `t("deforestationAnalysis:…")`, `useTranslation`, namespace list (pages, `FlowLayout`, PDF worker), `utils/i18n.ts` and `src/test/i18n.ts` to `territorialAnalysis`
- [x] 2.4 Point every internal link and redirect to the new routes: `utils/flowStages.ts`, `hooks/useStageEntry.ts`, `MainNavigation`, `AnalysisOutdatedGuard`, the upload page's post-analysis navigation, and their tests
- [x] 2.5 In `src/locales/usedKeys.test.ts`, fail on any source literal that starts with `deforestationAnalysis:` (design D3)

## 3. Components, hooks, types and state

- [x] 3.1 `git mv` `components/page/deforestationAnalysis/` to `components/page/territorialAnalysis/` and update imports
- [x] 3.2 Rename the components of design D2 (`TerritorialAnalysisUploadDataPageContent`, `LayerResultsTable`, `ReportResultsTable`, `NoObservationsCounterChip`, `LayerTilesOverlay`), files and tests included
- [x] 3.3 Rename the hooks of design D2 (`useVisibleDataForAnalysisPage`, `useNoObservationsCountByMap`, `useReportDownload`), files and tests included
- [x] 3.4 Rename `interfaces/DeforestationAnalysis.ts` to `interfaces/LayerAnalysis.ts` and `DeforestationAnalysisMapResults` to `LayerAnalysisMapResults`
- [x] 3.5 Rename the `DataContext` state to `territorialAnalysisParams` / `territorialAnalysisResults` (setters, initial and sorted values), in the context, its consumers, `src/test/renderWithData.tsx` and the tests
- [x] 3.6 Rename the util modules and helpers of design D2 (`overlap.ts`, `layerImages.ts`, `report.tsx` + `report/`, `generateGeoJsonFarmsDataWithLayerAnalysis`, `buildLayerSheets`, `formatResultPercentage`, `getResultChip*Color`) and the local names, tests included
- [x] 3.7 `grep -rniE "deforest"` over `apps/web/src` and check that every remaining hit is in the "Kept" table of design D2

## 4. Docs

- [x] 4.1 `docs/onboarding.md`: the stage 2 routes, the app tree and the `DataContext` field names
- [x] 4.2 `apps/web/README.md`: the locales tree and the namespace description
- [x] 4.3 `CHANGELOG.md`: Unreleased entry for the new routes and the redirects

## 5. Verification

- [x] 5.1 Web checks from `CLAUDE.md`: `pnpm install --frozen-lockfile`, schema check, `pnpm exec tsc --noEmit`, `pnpm run lint`, `pnpm test`, `pnpm run build`
- [x] 5.2 In the browser, in `es` and `en`, desktop and 390 px: landing, stage 1, stage 2 (selection and results), stage 3 with the PDF, and Metodología
- [x] 5.3 In the browser and with `curl -I`: `/deforestation-analysis`, `/es/deforestation-analysis`, `/en/deforestation-analysis/upload-data` and one with a query string redirect with 308 to the new routes and keep the language
- [x] 5.4 `openspec validate territorial-analysis-routes --strict`
