## Context

Changing the UI language changes the `[locale]` segment, which remounts `DataProvider`; the flow
survives in the module-level `keptState` (`apps/web/src/context/DataContext.tsx:210-225`). The
remounted provider fetches `GET /maps` in the new language (`DataContext.tsx:492-512`, effect
`:547-559` keyed on `[locale, selectedCountry]`), and `onMapsLoaded` replaces the analysed layers
with the listed ones by id (`DataContext.tsx:391-454`). A layer no longer listed keeps its old
object while results exist (`DataContext.tsx:426-429`).

Reproduced on `dev` at `478defc` (2026-11-25) with a temporary Vitest test that remounts the real
provider from `es` to `en`:

1. **Modal.** `MapsDetailsModal` copies the first layer into state,
   `useState<MapData | null>(selectedMaps[0])` (`components/page/territorialAnalysis/MapsDetailsModal.tsx:34-36`).
   It is always mounted under `PageTitle` (`PageTitle.tsx:56`), so the copy is taken from the kept
   (old-language) layers before `/maps` answers. After the refresh the chip reads the new language
   (`layerLabel(map)`, `:105`) while the details still read the copy (`selectedMap[keyword]`,
   `:146-206`): `source: "Fuente ES"` under an English chip.
2. **PDF.** The report page copies the analysed layers into `reportGenerationParams.selectedMaps`
   once (`components/page/reportGeneration/ReportPageContent.tsx:33-41`); nothing refreshes that
   copy, and `ReportProvider` renders from it (`context/ReportContext.tsx:209-257`). Its cache key
   (`ReportContext.tsx:231-237`) holds the country, locale, result versions, farms and categories,
   not the layer texts, so a preview or complete PDF rendered with old texts is reused by
   `getCompleteReport` (`ReportContext.tsx:545-553`).
3. **Exports.** `DownloadPageData` reads `territorialAnalysisParams.selectedMaps`
   (`components/page/territorialAnalysis/DownloadPageData.tsx:22-25`), which the refresh updates
   for listed layers. A layer hidden after the analysis (the "Áreas test" case of #141, category
   disabled) is never listed again in any language — `GET /maps` returns only public layers
   (`apps/api/app/modules/maps/router.py:63-75`) — so it keeps its old-language object.

Per-language fields of a layer come from its language files: `name`, `alias`, `coverage`,
`source`, `resolution`, `contentDate`, `updateFrequency`, `publishDate` (`read_attributes`) and
`considerations` (`read_considerations`) (`router.py:79-104`). `references`, `version`,
`pixelSize`, `baseline`, `comparedAgainst`, `categoryId`, `country` and
`availableCountriesCodes` don't depend on the language. The UI languages are
`i18nConfig.locales` = `["es", "en"]` (`apps/web/src/i18nConfig.ts:2`).

## Goals / Non-Goals

**Goals:** the modal, the PDF and the exports show the analysed layers' texts in the current
language, also for a layer hidden after the analysis; a downloaded PDF is never one rendered with
other texts; no re-analysis and no extra image fetches on a language change.

**Non-Goals:** API changes (decided: option (a), no `GET /maps` for hidden layers); category texts
(already bilingual); retrying a failed extra fetch.

## Decisions

### D1. The modal keeps the chosen layer's id

`MapsDetailsModal` keeps `selectedMapId: number | null` (initially `null`) and derives
`selectedMap = selectedMaps.find((map) => map.id === selectedMapId) ?? selectedMaps[0] ?? null`.
Chip clicks and the arrow keys set the id. A chosen layer that leaves `selectedMaps` falls back to
the first one. *Rejected:* an effect that resyncs the copy (one stale render, more code).

### D2. The refresh also replaces the report's chosen layers (user decision 2a)

In `onMapsLoaded`, right after `refreshed` is computed (`DataContext.tsx:426-429`) and
independently of whether the analysed layers changed:

```ts
setReportGenerationParams((prev) => {
  const maps = replaceById(prev.selectedMaps, refreshed);
  return maps === prev.selectedMaps ? prev : { ...prev, selectedMaps: maps };
});
```

`replaceById(layers, by)` (new, `utils/layerTexts.ts`) returns each layer's same-id entry of `by`,
or the layer itself; it returns the **same array** when no entry changed identity, so the 5-minute
poll doesn't churn state. The user's choice (which ids) and its order are kept. The early return
`if (!selectedMaps.length) return;` (`:421`) stays before it: without analysed layers there is no
report choice. *Rejected (user decision):* storing only ids in `reportGenerationParams` (~8 files).

### D3. The report's cache key includes the layer texts; images keep their own key

`Selection` (`ReportContext.tsx:54-67`) gains `imagesKey: string`, today's key
(`ReportContext.tsx:231-237`). `key` becomes
`JSON.stringify([imagesKey, selectedMaps.map(layerTextsOf)])`. `render` fetches images with
`keyed(imagesRef, s.imagesKey, …)` (`:284`). Preview, complete PDF, stale notice and download
keep using `key` (`:474`, `:496`, `:550`, `:585-590`), so texts arriving after the preview was asked
for mark it as not matching the current choice, and the download renders again with the new texts
without fetching images. *Rejected:* holding the selection until the new language's list arrives
(DataContext exposes no "loaded for this locale" flag; a failed fetch would block the report).

### D4. Layer texts are kept per language, and fill in a hidden layer (user decision 1a)

`utils/layerTexts.ts` (new) exports `LAYER_TEXT_KEYS` (the nine per-language fields above),
`type LayerTexts`, `layerTextsOf(map)`, `withLayerTexts(map, texts)` and `replaceById`.
`withLayerTexts` returns `map` itself when `texts` is undefined or every text field is equal,
else `{ ...map, ...texts }`: calculation fields always stay those of `map`.

`DataContext.tsx` keeps a module-level store next to `keptState`:
`keptLayerTexts = new Map<string, LayerTexts>()` keyed `` `${language}:${country}:${id}` ``, plus
`layerTextsFetches = new Set<string>()` of in-flight `` `${language}:${country}` ``.
`resetDataStoreForTests` (`:233-237`) clears both.

- `onMapsLoaded(maps, categories, country)` stores `layerTextsOf(map)` of every listed layer for
  `locale` before computing `refreshed`.
- The hidden branch (`:429`) becomes
  `return territorialAnalysisResults ? [withLayerTexts(selected, keptLayerTexts.get(key(locale, country, selected.id)))] : [];`.
  The calculation comparison (`:431-442`) is untouched: texts never invalidate an analysis.
- A new effect, on `[territorialAnalysisResults, selectedCountry, locale]` (reading
  `selectedMaps` through a `useEffectEvent`): when results exist and a country is selected, for
  each language of `i18nConfig.locales` other than `locale`, if some analysed layer has no kept
  texts for it and no fetch for `language:country` is in flight, it calls
  `getMaps(language, country)` once and stores `layerTextsOf` of every returned layer. A failure is
  logged (`console.error`) and swallowed: the layer keeps its last texts. It never touches state;
  the texts are read at the next refresh, which happens on the language change that needs them.

Because the store is module-level, it survives the remount; the remounted provider's `/maps`
answer for the new language also lands in it. Layer texts are public catalog data, not farm data:
the "no farm data on the server" invariant is unaffected.

*Rejected:* fetching the other language in `TerritorialAnalysisLayersPageContent` right after
`analyzeLayers` (`:269-276`) — couples the page to i18n and misses a flow restored without that
page; keeping texts inside `territorialAnalysisParams` — widens every literal that sets it
(`TerritorialAnalysisLayersPageContent.tsx:275`, `hooks/useCountryChange.ts:40-49`).

### API contract / data shape / cross-stack wiring

N/A — web only; `GET /maps` is called with the parameters it already takes
(`apps/web/src/api/layerAnalysis.ts:32-46`). No new state field in `DataContextValue`.

### Signal tracing

N/A — the change introduces no signal between stages or systems.

## Hazards (per touched file)

| File | Known failure mode | Evidence |
|---|---|---|
| `context/DataContext.tsx` | A refresh that sets state on every 5-minute poll, or that invalidates an analysis on a text-only change. Kept module state leaking between tests. | `:431-454` (identity checks), `:233-237`; #75, #141 review ("hidden layer lost from exports") |
| `context/ReportContext.tsx` | Fetching the report images more than once per selection (spec `report-generation` "Report images are fetched once per selection"); a key change wrongly marking a preview stale. | `:284`, `:585-590`; #149, #65 |
| `components/page/territorialAnalysis/MapsDetailsModal.tsx` | Keyboard radio-group navigation reads `selectedMap.id` (`:71-81`) and must keep working with the id. | #159 |
| `utils/layerTexts.ts` (new) | None known. | — |
| Test files | `keptState`-style module state must be reset between tests (`resetDataStoreForTests`). | `test/renderWithDataProvider.tsx`, `DataContext.test.tsx:539-551` |

## Risks / Trade-offs

- [A layer hidden before the extra fetch answered, with that fetch failing] → it keeps its last
  texts (spec scenario "Texts of the other language unavailable"). Accepted.
- [Preview asked for in the ~1 s before the new list arrives] → it is shown, then marked stale;
  the download renders the new texts. Accepted over blocking the report.
- [One extra `GET /maps` per analysis in a language not seen yet] → at most one per language and
  country while texts are missing; guarded against duplicates.

## Migration Plan

None: client-side only, nothing persisted. Rollback is reverting the PR.
