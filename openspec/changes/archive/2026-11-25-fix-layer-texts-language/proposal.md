## Why

The texts of the analysed layers (name, alias, source, coverage, considerations…) stay in the
language they were chosen or analysed in when the user switches the UI language: the "Detalles de
las capas" modal, the PDF report and the exports mix Spanish and English (issue #167, follow-ups of
#116 from the reviews of #141, #143 and #144). The report is audit evidence, so a PDF in `en` must
not carry Spanish layer texts. Reproduced on `dev` at `478defc` on 2026-11-25 with the real
`DataProvider` remounted from `es` to `en`.

## What Changes

- The layer details modal keeps the id of the chosen layer, not a copy of it, so its details
  follow the refreshed layer list (today it shows the old language until another chip is clicked).
- The refresh that replaces the analysed layers with the `GET /maps` response of the new language
  also replaces, by id, the layers of the report's choice (`reportGenerationParams.selectedMaps`),
  which today are never refreshed.
- The report's cache key includes the texts of its layers, so a preview or a complete PDF rendered
  with the old texts is never reused for a download; the layer images keep their own key and are
  not fetched again.
- When an analysis has results, the web keeps the texts of its layers in every UI language
  (`es`, `en`): it fetches `GET /maps` once in each language it has not seen yet. A layer hidden
  after the analysis (disabled, or its category disabled) is no longer listed by `GET /maps` in any
  language, so its texts in the current language come from what was kept. If that fetch fails, the
  layer keeps its last texts, as today.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `territorial-analysis`: new requirement — the analysed layers' texts follow the UI language in
  the layer details modal and the exports, also for a layer hidden after the analysis.
- `report-generation`: new requirement — the report's layer texts follow the UI language, and a
  PDF rendered with other texts is never downloaded.

## Non-goals

- No API change: `GET /maps` keeps listing only public layers (option (c) of the issue, rejected).
  The texts of a hidden layer come from what the web kept while it was listed.
- No re-analysis on a language change: only texts change. Calculation fields (`version`,
  `pixelSize`, `baseline`, `comparedAgainst`, `categoryId`) of a hidden layer stay those of the
  analysis.
- A layer hidden **before** the web ever saw it in the other language, with the extra fetch
  failing, keeps its last texts; no retry loop.
- Category texts are out of scope: `GET /categories` already returns both languages and the UI
  picks one with `localizedText`.

## Impact

- Web only: `apps/web/src/context/DataContext.tsx`, `apps/web/src/context/ReportContext.tsx`,
  `apps/web/src/components/page/territorialAnalysis/MapsDetailsModal.tsx`, one new helper under
  `apps/web/src/utils/`, and their tests.
- One extra `GET /maps?language=<other>&country=<CC>` per analysed country and language not seen
  yet; at most one per language while the analysis lives.
- No contract change, no new environment variable, no new translation key.
