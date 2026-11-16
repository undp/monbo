## Context

- The flow lives in three route segments, each with a `layout.tsx` that only wraps
  `RequireCountry`: `polygons-validation`, `deforestation-analysis` and `report-generation`, with
  their `upload-data` and `preview` sub-pages.
- Each results page fills the viewport exactly (`height: calc(100vh - 64px)`) and has a fixed
  bottom `Footer`. The move from stage 1 to 2 is `DeforestationModal`, opened by the validation
  footer's "Analizar" button. The move from stage 2 to 3 is `MapSelectionModal`, opened by
  "Crear reporte". `/report-generation` needs `reportGenerationParams.selectedMaps`, which only
  that modal fills.
- The whole flow state is in `DataContext` (`polygonsValidationResults`,
  `deforestationAnalysisResults`, `analysisOutdated`, `reportGenerationParams`). There is no
  database, and a reload drops the flow by design.
- The reference is mockup v2: `stepper()`, `header()`, `next()`, and the `.flowhead`, `.stepper`,
  `.st`, `.bar` and `.next` styles in `mockup-source.html`.
- Parallel units: GC-9 (`feat/new-landing`) rebuilds the landing and its dark header and removes
  `/home`. GC-6 changes the stage 2 content. GC-13 renames the routes at the end.

## Goals / Non-Goals

**Goals:**

- A flow header and stepper shared by every stage page, with states that are a pure function of
  `DataContext` and the route, unit-tested.
- Stage 2 reachable at any time (D5). Stage 3 only with results.
- A "Siguiente etapa" card that reuses the existing transitions, without changing what they do.
- Stage 1 free of digits that can be read as stages.

**Non-Goals:**

- Changing the stage 2 content (layer selection, results table, map): that's GC-6.
- Renaming routes, namespaces or the `deforestationAnalysis` texts: GC-13 and GC-11.
- The landing and the header's new navigation (Inicio / Análisis / Metodología), brand and
  heading font: GC-9. This unit only removes the three module buttons from the header.
- Loading fonts. GC-9 adds Plus Jakarta Sans with `next/font` as `--font-heading`; this unit only
  references that variable.
- Replacing the transition modals with pages.

## Decisions

### 1. A pure derivation module plus a thin hook

`utils/flowStages.ts` exports:
- `stageFromPathname(pathname)`, which returns `1 | 2 | 3 | null`;
- `deriveFlowStages({ current, validationDone, analysisDone })`, which returns the three stages
  with their `state` (`current | done | available | skipped | locked`) and the progress of the
  two bars;
- `stageHref(stage, flags)`.

`hooks/useFlowStages.ts` reads `usePathname()` and `DataContext`, and calls them.
- `validationDone` is `polygonsValidationResults !== null`.
- `analysisDone` is `deforestationAnalysisResults !== null && !analysisOutdated`.
- The label key comes from the state plus the stage: "available" is "Puedes ir directo" for
  stage 2 and "Disponible" for stage 3.

*Why:* the scenarios in the spec are table tests on a pure function, which is cheap and exact.
*Alternative:* computing it inside the component. It's harder to test, and it mixes the routing
with the rendering.

The mockup labels an available stage 3 as "Puedes ir directo" when the user is on stage 1. The
issue says that label is for stage 2 only, so an available stage 3 always says "Disponible".

### 2. The header is rendered by each stage layout

Each of the three `layout.tsx` renders `<FlowLayout locale>`. It is an async server component
that loads the `flow` namespace into its own `TranslationsProvider`, as `Header` already does, and
renders the client `FlowHeader` above `children`, inside `RequireCountry`.

*Why:* the pages and the GC-6 content don't change, and every sub-page (`upload-data`, `preview`)
gets the header for free.
*Alternative:* an `app/[locale]/(flow)/` route group with one layout. It moves the three
directories, which collides with GC-6 and GC-13 for little gain.

### 3. The next-stage card reuses the modals

The `NextStageCard` component (`components/page/flow/`) is presentational: number, title,
description, `onContinue`. The validation and analysis `PageFooter`s become the card, opening
`DeforestationModal` and `MapSelectionModal` exactly as the buttons did, and they stop rendering
the fixed `Footer`.

Stage 3 from the stepper uses `MapSelectionModal` too, when `reportGenerationParams.selectedMaps`
is empty, so `/report-generation` is never opened without layers. That modal reads only
`DataContext`, so the stepper can host it.

*Why:* it keeps the polygon-subset and report-layer rules intact and avoids touching the GC-6 page.
*Alternative:* pages instead of modals, as in the mockup. That changes the stage 2 content, which
belongs to GC-6.

### 4. Pages scroll, and tables keep a usable height

The results pages stop fitting the viewport. The page is the flow header, the title row, a table
section with `height: max(420px, calc(100vh - 64px - 140px))`, and the card. The table keeps a
bounded height, which `Table` (`TableContainer height: 100%`) needs. The report pages keep their
footers, which hold the download actions, and get bottom padding so the footer doesn't cover them.

`DevEnvWarning` moves into the flow header's meta row, so the flow pages show it once:
- it leaves the validation and analysis footers, which no longer exist;
- it leaves `UploadPageContent`, which only the flow uses;
- the report footers keep their own copy, so their layout doesn't change.

### 5. Styling and animation

The styles go in MUI `sx` with the mockup's values: the gradient over `/images/forest.jpg`, a
translucent stepper box, 38 px dots, and 3 px bars. The colors are added to `config/theme.ts`
only if they are reused: `#5cc08a` (leaf) and the navy/forest gradient. The entrance uses
`keyframes` from `@mui/material/styles`:
- `rise` with 0.05 s, 0.35 s and 0.65 s delays;
- `fill` on the bars with 0.25 s and 0.55 s delays;
- `@media (prefers-reduced-motion: reduce)` turns both off.

The header's and the stepper's titles use
`fontFamily: "var(--font-heading, var(--font-roboto)), sans-serif"`, so they render in Roboto
before GC-9 merges and in Plus Jakarta Sans after, with no change here.

The stepper is a `<nav aria-label>` with an `<ol>`:
- stages 1 and 2, and stage 3 with results, are `ButtonBase` elements;
- the current one has `aria-current="step"`;
- a locked stage 3 is plain text.

Below the `md` breakpoint the grid becomes one column, and the bars are hidden.

### 6. Stage 1 without digits

- `TextHeaderStepContainer` takes an optional `icon`. Stage 1 passes an upload icon, and the
  stage 2 sections stay as they are (GC-6).
- `FarmsUploadStep`'s list title "Fincas a cargar" gets a list icon.
- `OptionCard`'s `<ol>` keeps its order but renders a chevron per line instead of a digit, on both
  stages, since the component is shared.

### 7. Forest image

The user chose the mockup's images (Gate 1). The background is the mockup's `img/forest.jpg`
(900×832, 158 KB, an AI-generated aerial view of a river through rainforest). It is renamed to
`public/images/aerial-river-rainforest.jpg`, a descriptive name, as GC-9 does with the hero
image. It is used under the gradient overlay at `center 40% / cover`, so its resolution is
enough for the header's height.

### 8. Header module buttons

`Header/index.tsx` drops the three `HeaderButton`s for `/polygons-validation`,
`/deforestation-analysis` and `/report-generation`. The "Home" button, the country menu, the
documentation button and the language menu stay as they are. GC-9 replaces that navigation, and
whoever merges second rebases. The `home:header:validation|deforestation|report` keys are removed
from both locales, since nothing else uses them.

## Risks / Trade-offs

- **The image is AI-generated and referential.** The user chose to use the mockup's images.
  → If the client asks for another image, it only takes replacing the file.
- **Pressing stage 2 can start the analysis right away.** The stage 2 upload page already starts
  it on mount when farms and layers are loaded, for example after the user ticked layers in the
  modal and closed it. This is existing behavior, reachable today from the modal, and this unit
  doesn't change it. → It is documented here, and GC-6 owns that page.
- **Pressing stage 1 after a direct entry validates the loaded farms.** The upload page validates
  `farmsData` on mount. That is the useful outcome, since "Sin realizar · opcional" becomes
  "Completada", and it is acceptable.
- **Merge conflicts with GC-9 in `Header/index.tsx` and `home.json`.** → This unit only deletes
  lines there. Whoever merges second rebases.
- **Merge conflicts with GC-6.** Both touch `deforestation-analysis/page.tsx` and its
  `PageFooter`. → This unit changes only the wrapper boxes, the heights and the footer. Whoever
  merges second rebases.
- **`utils/i18n.ts` is shared.** Every unit that adds a namespace edits its imports. → The
  conflicts are trivial, and they are resolved on rebase.

## Migration Plan

Web only, with nothing to migrate. It rides Tren 1. Rollback means reverting the PR.

## Resolved at Gate 1 (user, 2026-11-16)

- Image: use the mockup's images. The forest image is renamed to a descriptive name.
- Header: GC-10 removes the three module buttons. GC-9 adds the new navigation.
- The stage 2 "Paso 1 / Paso 2" titles stay for GC-6.
- Heading font: use GC-9's `--font-heading`, with Roboto as fallback.

## Open Questions

None.
