Groups 1–4 write disjoint files. Every tripwire names its mutant for
`falsify.mjs` (`--find` / `--replace`, on the post-change tree). A **fix tripwire** must be seen red
on the pre-change tree before its fix is applied; a **regression guard** is green pre-change and is
falsified by its mutant.

## 1. Layer text helpers

Files: apps/web/src/utils/layerTexts.ts, apps/web/src/utils/layerTexts.test.ts

- [x] 1.1 Create `utils/layerTexts.ts` with `LAYER_TEXT_KEYS` (`name`, `alias`, `coverage`, `source`, `resolution`, `contentDate`, `updateFrequency`, `publishDate`, `considerations`), `type LayerTexts = Pick<MapData, (typeof LAYER_TEXT_KEYS)[number]>`, `layerTextsOf(map)`, `withLayerTexts(map, texts?)` and `replaceById(layers, by)` as in design D4/D2. `withLayerTexts` returns `map` itself when `texts` is undefined or every text field is equal, else `return { ...map, ...texts };`. `replaceById` returns the same array when no entry changed identity.
- [x] 1.2 Test `utils/layerTexts.test.ts` (regression guards for the helpers): `withLayerTexts` replaces only the text fields and keeps `version`, `pixelSize`, `baseline`, `comparedAgainst`, `categoryId`, `references`; returns the same object for undefined or equal texts; `replaceById` keeps order and ids not in `by`, and returns the same array when nothing changed. Mutant: `--find "return { ...map, ...texts };" --replace "return { ...texts, ...map };"`.

## 2. Modal follows the refreshed layers

Files: apps/web/src/components/page/territorialAnalysis/MapsDetailsModal.tsx, apps/web/src/components/page/territorialAnalysis/MapsDetailsModal.test.tsx

- [x] 2.1 Fix tripwire first — new `MapsDetailsModal.test.tsx`: render the open modal under an injected `DataContext` (`makeDataContext`) whose `selectedMaps` is one layer with `alias: "Áreas test"`, `source: "Fuente ES"`; rerender with the same id and `alias: "Test areas"`, `source: "Source EN"`, without clicking a chip; expect "Source EN" shown and "Fuente ES" absent. Observe it red on the pre-change tree. Mutant (post-change, brings back the snapshot): `--find "selectedMaps.find((map) => map.id === selectedMapId) ?? selectedMaps[0] ?? null;" --replace "(([snapshot]) => snapshot.find((map) => map.id === selectedMapId) ?? snapshot[0] ?? null)(useState(selectedMaps));"`.
- [x] 2.2 Implement D1: `selectedMapId` state (initially `null`) and `const selectedMap =` followed by the expression `selectedMaps.find((map) => map.id === selectedMapId) ?? selectedMaps[0] ?? null;` (keep that literal text: the mutant of 2.1 targets it); chip `onClick` and the arrow-key handler (`:71-81`) set the id. Keep the radio-group behaviour.
- [x] 2.3 Regression guards in the same test file: clicking a second chip shows its details and survives a rerender with new texts for both layers (mutant: `--find "onClick={() => setSelectedMapId(map.id)}" --replace "onClick={() => {}}"`); ArrowRight moves the choice to the next layer (mutant: `--find "setSelectedMapId(next.id);" --replace ""`).

## 3. Refresh: report choice and hidden layers' texts

Files: apps/web/src/context/DataContext.tsx, apps/web/src/context/DataContext.test.tsx

- [x] 3.1 Fix tripwire (PDF data) in `DataContext.test.tsx`: with the real provider (`renderWithDataProvider`, `getMaps` mocked by language), analyse layer 1 in `es`, set `reportGenerationParams` `{ seeded: true, selectedMaps: [es layer] }`, `remount("en")`, flush; expect `reportGenerationParams.selectedMaps[0].alias` to be the English alias and `seeded` still `true`. Observe red pre-change. Mutant: `--find "const maps = replaceById(prev.selectedMaps, refreshed);" --replace "const maps = prev.selectedMaps;"`.
- [x] 3.2 Fix tripwire (exports / hidden layer): analyse layers 1 and 2 in `es` with results; the extra `getMaps("en", "CR")` returns both with English texts; then `/maps` stops listing layer 2 in both languages; `remount("en")`, flush; expect layer 2 still in `territorialAnalysisParams.selectedMaps` with alias "Test areas", its `version`/`categoryId` unchanged, the results kept and `invalidateAnalysis` not triggered (`analysisOutdated` false). Observe red pre-change. Mutant: `--find "return { ...map, ...texts };" --replace "return map;"`.
- [x] 3.3 Fix tripwire (one extra fetch): after results are set in `es`, `getMaps` is called exactly once with `("en", "CR")`; a further poll (`AVAILABLE_MAPS_POLLING_INTERVAL`), and a remount to `en` and back to `es`, do not call it with `("en", "CR")` again while those texts are kept. Observe red pre-change (never called). Mutant: `--find "if (!missing) continue;" --replace ""`.
- [x] 3.4 Regression guard (failed extra fetch): `getMaps("en", …)` rejects; hide layer 2; `remount("en")`; layer 2 keeps its Spanish texts and its results stay. Mutant: `--find "return territorialAnalysisResults ? [withLayerTexts(selected, kept)] : [];" --replace "return [];"`.
- [x] 3.5 Implement D2 and D4 in `DataContext.tsx`, with these literal lines (the mutants above target them):
  - module-level `keptLayerTexts = new Map<string, LayerTexts>()` and `layerTextsFetches = new Set<string>()`, a `textsKey(language, country, id)` helper, both stores cleared by `resetDataStoreForTests`;
  - in `onMapsLoaded`, store `layerTextsOf(map)` of every listed layer for `locale` before `refreshed`;
  - hidden branch: `const kept = keptLayerTexts.get(textsKey(locale, country, selected.id));` then `return territorialAnalysisResults ? [withLayerTexts(selected, kept)] : [];`;
  - after `refreshed`: `setReportGenerationParams` with `const maps = replaceById(prev.selectedMaps, refreshed);` (design D2);
  - the effect: for each `language` of `i18nConfig.locales` other than `locale`, `const missing = …some analysed layer without kept texts…;` `if (!missing) continue;` a `fetchKey` of the form `<language>:<country>`, `if (layerTextsFetches.has(fetchKey)) continue;`, then `getMaps(language, country)` storing every returned layer's texts, `console.error` and swallow on failure, delete `fetchKey` in `finally`.
- [x] 3.6 Keep the existing `DataContext.test.tsx` suite green, in particular "keeps the flow across a language change" and the hidden-layer / invalidation tests; adjust only `getMaps` call-count assertions that the extra fetch legitimately changes, and say which in the commit.

## 4. Report cache key

Files: apps/web/src/context/ReportContext.tsx, apps/web/src/context/ReportContext.test.tsx

- [x] 4.1 Fix tripwire in `ReportContext.test.tsx`: with `renderHookWithData`, a selection whose layer has Spanish texts; ask for the complete report (`getCompleteReport`); swap the context to the same layer with English texts and rerender; ask again; expect the worker's last `render` call to carry `maps[0].alias` in English. Observe red pre-change (the cached Spanish render is returned). Mutant: `--find "const key = JSON.stringify([imagesKey, selectedMaps.map(layerTextsOf)]);" --replace "const key = imagesKey;"`.
- [x] 4.2 Regression guard in the same file: in the scenario of 4.1, `fetchLayerImages` is called once. Mutant: `--find "keyed(imagesRef, s.imagesKey," --replace "keyed(imagesRef, s.key,"`.
- [x] 4.3 Implement D3: `imagesKey` on `Selection`, `key` built from it plus `selectedMaps.map(layerTextsOf)`, images fetched with `s.imagesKey`.

## 5. Verify

Files: none (commands only)

- [ ] 5.1 From `apps/web`: `pnpm exec tsc --noEmit`, `pnpm run lint`, `pnpm test`, all green.
- [x] 5.2 Run every mutant above with `falsify.mjs` and record that each turns its test red and the tree is restored.
