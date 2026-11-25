## Why

Each module has its own route and its own card on `/home`, and the jump from module 1 to
module 2 is a modal, so the client can't tell where they are in the flow or what comes next.
The client asked to show the stages progressively (1, then 2, then 3) and not to confuse them
with the steps of uploading polygons. The reference design is the Etapa 1, 2 and 3 screens of
mockup v2 (2026-11-16). Part of undp/monbo#126 (GC-10 of the "Gestor de capas" orchestration,
undp/monbo#116).

## What Changes

- A **flow header** on every page of the three stages (`/polygons-validation`,
  `/deforestation-analysis`, `/report-generation` and their sub-pages): a forest background
  (the mockup's image, renamed `aerial-river-rainforest.jpg`), "Análisis en {country} · Cambiar
  país", and the note "Gratis · tus polígonos no se guardan en nuestros servidores". Its titles
  use the heading font GC-9 adds (`--font-heading`, Plus Jakarta Sans), with Roboto as fallback.
- The application header **loses its three module buttons** (Validación / Análisis de
  deforestación / Reporte): the stepper replaces them, and they blocked stage 2 without results,
  against D5. No new navigation is added there: GC-9 owns it.
- A **stepper** inside it: Validación → Análisis territorial → Reporte, with a staggered
  entrance. Each stage shows one state, derived only from `DataContext` and the current route:
  "Estás aquí", "Completada", "Puedes ir directo" (stage 2 only), "Disponible" (stage 3 with
  results), "Sin realizar · opcional", and "Con los resultados de la etapa 2" (stage 3 without
  results, which can't be pressed). Stage 2 is never blocked (D5).
- Pressing a stage goes to that stage's page: its results when it has them, its upload page
  otherwise. Stage 3 without a report layer selection opens the existing report layer modal first.
- A **"Siguiente etapa" card** at the end of stage 1 (validation results) and stage 2
  (analysis results). It replaces the fixed footer's "Analizar" and "Crear reporte" buttons and
  opens the same modals they opened.
- **Stage 1 upload sections** get an icon next to their title, and the "how to" lines of the
  upload methods lose their digits (chevron bullets instead), so nothing on stage 1 is numbered
  like a stage.
- **Stage 1 follows the mockup's Etapa 1 screen** (adjusted on `feat/layer-manager` after the
  local run of 2026-11-18): the page head "Valida tus polígonos", the four upload methods as
  choices with one "Cómo hacerlo" panel for the selected one, the list of polygons and points in
  its own card, a bottom bar with the counts and "Validar polígonos", and on the validation
  results three counts (ready, overlapping, with a geometry error) above the tables.
- A page heading eyebrow "Etapa N de 3" on the stage pages.
- The flow pages scroll instead of fitting exactly into the viewport: the tables keep a fixed
  usable height, with the header above and the card below.
- New `flow` i18n namespace in `es` and `en`.

## Capabilities

### New Capabilities

- `analysis-flow-stages`: the flow header, the stepper and how each stage's state and
  destination are derived from the browser's flow state, and the "next stage" card.

### Modified Capabilities

- `farm-upload`: the four ways to upload become methods to choose from, with one "how to"
  panel for the selected one; its lines are bullets without digits, and the upload sections
  carry an icon with their title.

## Impact

- Web only (`apps/web`). No API, contract, server state or usage-event change.
- New: `components/page/flow/` (header, stepper, next-stage card), a pure stage-derivation
  module in `utils/` with its tests, a `hooks/useFlowStages.ts` hook, `locales/{es,en}/flow.json`,
  and `public/images/aerial-river-rainforest.jpg`.
- Changed: `components/reusable/Header/index.tsx` (module buttons removed, the "Home" button
  stays until GC-9 replaces it) and the three `home:header:*` keys they used, the three stage layouts, the page wrappers of the stage pages (layout and heights
  only: GC-6 owns the stage 2 content), `TextHeaderStepContainer`, `FarmsUploadStep`'s card step
  lists, the validation and analysis `PageFooter`s, `utils/i18n.ts` (namespace registration).
- Conflicts: GC-6 (undp/monbo#122) changes the stage 2 content (its "Paso 1 / Paso 2" titles
  stay for GC-6), GC-9 (undp/monbo#125) the landing and the header's new navigation, brand and
  heading font, GC-13 (undp/monbo#129) renames the routes later. Whoever merges second
  rebases.
