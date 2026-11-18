## Context

Stage 2 of the flow has been "Análisis territorial" since GC-10 and analyses layers of every category since GC-6, but its URL, its i18n namespace and many web identifiers still say "deforestation". GC-12 already renamed the API contract (`/layer_analysis/analyze`). This change renames the web side. It is the last unit of undp/monbo#116, so no other unit is editing these files.

Relevant facts found in the code (2026-11-18, `feat/layer-manager` at `c28633f`):

- The `/home` redirect lives in `src/proxy.tsx`, before `i18nRouter`, not in `next.config.ts` (the orchestration note says `next.config.ts`; the comment in `proxy.tsx` explains that a redirect in `next.config.ts` loops in the standalone server). It answers a 307.
- `next-i18n-router` (`prefixDefault: false`) redirects `/es/<path>` to `/<path>` and sets the `NEXT_LOCALE` cookie to `es` on that redirect. An unprefixed path with a `NEXT_LOCALE=en` cookie is redirected to `/en/<path>`.
- `DataContext` keeps the flow in module memory (`keptState`), never in browser storage, so renaming its keys loses nothing. The only storage key with the old name, `deforestationAnalysis.selectedCountries`, is a legacy `localStorage` key the app still deletes.
- No usage event carries the page path. The `module` value (`deforestation-analysis`) is a fixed label sent in `X-Monbo-Module` and accepted by a `Literal` in the API (D12).
- `src/locales/usedKeys.test.ts` checks literal `"namespace:key"` strings only for namespaces that exist, so a leftover `"deforestationAnalysis:…"` after the rename would go unnoticed.

## Goals / Non-Goals

**Goals:**

- Stage 2 served at `/territorial-analysis` and `/territorial-analysis/upload-data`, and every old URL redirected there permanently, keeping language, sub-path and query.
- Namespace `territorialAnalysis` and every identifier that is generic (works for any layer or category) free of the deforestation name.
- Behaviour, texts and numbers unchanged.

**Non-Goals:**

- API routes, schemas, `openapi.json`, `schema.d.ts`.
- Usage events, the `deforestation-analysis` module value, `DEFORESTATION_THRESHOLD_PERCENTAGE` and `deforestationThresholdPercentage` from `GET /config`, `MAX_REQUESTS_FOR_SATELLITE_BACKGROUND_AT_DEFORESTATION_IMAGE_GENERATION` (D12).
- Text changes (GC-11 owns copy), upload templates in `public/files/`, image assets in `public/images/`, `docs/deforestation_calculation.md` (it is about the ratio).
- The `/home` redirect's status code (307); it is GC-9's and not a stage 2 route.

## Decisions

### D1. Redirects in `proxy.tsx`, permanent, prefix kept as requested

A regular expression `^(/(?:es|en))?/deforestation-analysis(?=/|$)(.*)$` built from `i18nConfig.locales` matches the old routes. The proxy answers `NextResponse.redirect(url, 308)` with the path rewritten to `${prefix}/territorial-analysis${rest}`; `request.nextUrl.clone()` keeps the query string. It runs before `i18nRouter`, like `/home`.

- **Prefix as requested:** `/es/deforestation-analysis` → `/es/territorial-analysis`, which `i18nRouter` then sends to `/territorial-analysis` while setting `NEXT_LOCALE=es`. Going straight to `/territorial-analysis` would save a hop but lose the language when the cookie says `en`, so the requested prefix wins (and the acceptance criterion names `/es/territorial-analysis`).
- **308, not 301:** permanent and keeps the method; browsers and crawlers update bookmarks and indexes.
- **Alternatives:** `redirects()` in `next.config.ts` (rejected: GC-9 found it loops in the standalone server); keeping a page at the old path that calls `redirect()` (rejected: prerendered pages loop in the build, and it would keep a route folder alive).

### D2. Rename table

Renamed (generic: they work for any layer or category):

| Kind | Before | After |
|---|---|---|
| Route folder | `app/[locale]/deforestation-analysis/` | `app/[locale]/territorial-analysis/` |
| Page component | `DeforestationAnalysis` (stage 2 page) | `TerritorialAnalysis` |
| Page component | `DeforestationAnalysis` (report page, a copy-paste name) | `ReportGeneration` |
| Namespace | `locales/{es,en}/deforestationAnalysis.json` | `locales/{es,en}/territorialAnalysis.json` |
| i18n key | `territorialAnalysis:deforestationMapFooter` | `territorialAnalysis:mapFooter` |
| i18n key | `home:sameDataModal.deforestationAnalysis.*` | `home:sameDataModal.territorialAnalysis.*` |
| Component folder | `components/page/deforestationAnalysis/` | `components/page/territorialAnalysis/` |
| Component | `DeforestationAnalysisUploadDataPageContent` | `TerritorialAnalysisUploadDataPageContent` |
| Component | `territorialAnalysis/DeforestationResultsTable` | `territorialAnalysis/LayerResultsTable` |
| Component | `reportGeneration/DeforestationResultsTable` | `reportGeneration/ReportResultsTable` |
| Component | `DeforestationFreeCounterChip` | `NoObservationsCounterChip` |
| Component | `DeforestationMapOverlay` (draws the selected layer's tiles, any category) | `LayerTilesOverlay` |
| Hook | `useVisibleDataForDeforestationPage` | `useVisibleDataForAnalysisPage` |
| Hook | `useDeforestationFreeResultsCountByMap` | `useNoObservationsCountByMap` |
| Hook | `useDeforestationReportDownload` | `useReportDownload` |
| Type module | `interfaces/DeforestationAnalysis.ts` | `interfaces/LayerAnalysis.ts` |
| Type | `DeforestationAnalysisMapResults` (D17) | `LayerAnalysisMapResults` |
| `DataContext` | `deforestationAnalysisParams` / `setDeforestationAnalysisParams` | `territorialAnalysisParams` / `setTerritorialAnalysisParams` |
| `DataContext` | `deforestationAnalysisResults` / `setDeforestationAnalysisResults` | `territorialAnalysisResults` / `setTerritorialAnalysisResults` |
| `DataContext` | `sortedDeforestationAnalysisParamsSelectedMaps`, `initialDeforestationAnalysisParams` | `sortedTerritorialAnalysisParamsSelectedMaps`, `initialTerritorialAnalysisParams` |
| Util module | `utils/deforestation.ts` (only holds the overlap check) | `utils/overlap.ts` |
| Util module | `utils/deforestationImages.ts` | `utils/layerImages.ts` |
| Util | `DeforestationImageBlob`, `fetchDeforestationImages` | `LayerImageBlob`, `fetchLayerImages` |
| Util module | `utils/deforestationReport.tsx` + `utils/deforestationReport/` | `utils/report.tsx` + `utils/report/` |
| Util | `DeforestationReportDocument`, `DeforestationReportImage` | `ReportDocument`, `ReportImage` |
| Util | `generateGeoJsonFarmsDataWithDeforestationAnalysis` | `generateGeoJsonFarmsDataWithLayerAnalysis` |
| Util | `buildDeforestationSheets` | `buildLayerSheets` |
| Util | `formatDeforestationPercentage` | `formatResultPercentage` |
| Util | `getDeforestationPercentageChipColor`, `…BackgroundColor` | `getResultChipColor`, `getResultChipBackgroundColor` |
| Locals | `performDeforestationAnalysis`, `selectedMapsForDeforestation`, `freeDeforestationFarms`, `deforestedFarms`, `deforestationValue`, `deforestationLevel`, … | names without "deforestation" (`performAnalysis`, `selectedMapsForAnalysis`, `okFarms`, `flaggedFarms`, `value`, …) |
| Tests | `*.test.ts(x)` next to each renamed file | renamed with it |

Kept (contract, decision D12, or really about forest loss):

| Name | Why it stays |
|---|---|
| API routes and schemas, `src/api/schema.d.ts` | Contract (GC-12 owns it). |
| `UsageModule = "deforestation-analysis"`, `X-Monbo-Module` value, API `UploadModule` | Usage event names (D12); no event carries the page path, so the dashboard counts the same. |
| `deforestationThresholdPercentage`, `getDeforestationThreshold()` | Field of `GET /config` (contract) and its reader; the global fallback threshold (D3, D12). |
| `deforestationRule()` | The rule of the default "Deforestación" category (PDF and exports fall back to it). |
| `MAX_REQUESTS_FOR_SATELLITE_BACKGROUND_AT_DEFORESTATION_IMAGE_GENERATION` | Infra variable (D12). |
| `deforestationAnalysis.selectedCountries` (`localStorage` key) | Real legacy key the app deletes; renaming it would stop the cleanup. |
| `home:landing.categories.deforestation`, category id `deforestation` | The "Deforestación" category itself. |
| `public/images/deforestationReportCoverBackground*.png`, `public/files/` | Assets and upload templates, out of scope. |
| `docs/deforestation_calculation.md` | Documents the forest-loss ratio. |
| Downloaded file names `deforestation-reports.zip`, `deforestation-complete-report.pdf` (`useReportDownload`) | User-visible names; changing them is a product decision, proposed as a follow-up. |
| Documentation anchor `#deforestation` (`FORMER_SECTION_ANCHORS`) | Kept on purpose so old links open the calculation section. |
| `deforestation` keys in `config/theme.ts`, `LandingSteps` and `DEFAULT_CATEGORY_ID` | The "Deforestación" category's color, landing chip and default id. |

### D3. Guard against stale namespace keys

`usedKeys.test.ts` gains a check that no source file has a literal starting with `deforestationAnalysis:`, so a missed `t()` fails a test instead of showing a raw key (the existing check ignores namespaces that don't exist). `src/test/i18n.ts` and the namespace lists (`FlowLayout`, pages, the PDF worker, `utils/i18n.ts`) load `territorialAnalysis`.

### D4. Specs: deltas on top of unarchived changes

Four capabilities that name the route exist only in unarchived changes. Following `territorial-analysis-by-category`, this change writes `MODIFIED` deltas copied from the latest version of each requirement, with only the path changed, and must be archived after `progressive-flow-stages`, `new-landing` and `territorial-analysis-by-category`. A new capability `web-routes` records the routes, the redirects and the namespace.

### D5. Moves with `git mv`

Every file move uses `git mv` so the PR diff shows renames, and identifier renames are done per file with TypeScript as the safety net (`tsc --noEmit` fails on any missed import or property).

## Risks / Trade-offs

- [A tab open on the previous bundle navigates to `/deforestation-analysis/...`] → The proxy redirects it; the in-memory flow survives a client navigation but a full reload drops it, as today.
- [Big diff, mostly renames] → `git mv`, one rename per kind, no logic change in the same commits; `tsc`, ESLint and the full Vitest suite must pass.
- [A missed `t("deforestationAnalysis:…")` shows a raw key] → D3's test, plus a final `grep` for the old names with the kept list above as the allowlist.
- [Archiving the deltas in the wrong order] → Stated in the proposal and here; the archive of the whole feature happens once, after integration.

## Migration Plan

Ships with the integration PR `feat/layer-manager` → `dev`. No data migration: the flow lives in memory. Old links (bookmarks, the example PDFs, shared URLs) are covered by the 308. Rollback is reverting the commit; the redirect goes away with it and the old routes come back.

## Open Questions

None. Closed at plan approval (2026-11-18, @BlancaMunizaga):

- `DeforestationMapOverlay` draws the tiles of whichever layer is selected, of any category, so it is renamed to `LayerTilesOverlay`.
- The generic util modules and helpers of D2 are renamed in this change, not left for a follow-up.
