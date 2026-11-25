## Why

The client asked for the "available maps" information to live in the methodology, not on
the landing page, and Monbo now groups each country's layers into categories (GC-1,
`GET /categories`). The documentation page still explains only the deforestation
percentage and lists no layers: the landing's "Ver capas por país" link lands on
`/documentation#deforestation`, which shows none. This is unit GC-8 of the layer manager
orchestration (undp/monbo#116, sub-issue #124), built from the Methodology view of mockup
v2.

## What Changes

- The documentation page becomes the **Methodology page** of mockup v2: eyebrow
  "Metodología", title "Cómo funciona Monbo", and a side index on wide screens (the top
  index stays on phones). The route stays `/documentation` (route renames are GC-13).
- The deforestation section becomes a **generic calculation section** (`calculation`):
  `% del polígono = área que coincide con la capa / área total del polígono`, with the
  partial-pixel rule, Gauss's formula, the worked example and the "no result" cases kept,
  reworded for any layer. The old `#deforestation` anchor keeps landing on it.
- New **categories section** (`categories`, Markdown): what a category is, the two
  polarities (what to avoid, what is required), the threshold rule ("with findings" above
  the category's threshold, the deployment's default otherwise) and "no data".
- New **layers by country section** (`layers`): one tab per public country
  (`GET /countries`) with its silhouette. Each tab lists the country's categories
  (`GET /categories`: icon, color, name, description, polarity in words, threshold, result
  labels) and, under each one, its layers (`GET /maps`): name, coverage, source, period,
  resolution and update frequency. A table on wide screens, cards on phones.
- New **scope and limits section** (`limits`): each layer of the selected country, with its
  category and its considerations (from `GET /maps`) in a collapsible block, plus its
  references.
- The first tab is the session's country when there is one; **switching tabs never
  changes the session's country**.
- The landing's "Ver capas por país" link points to `/documentation#layers`.
- The web client shared with GC-6 and GC-7: `api/layerCategories.ts`
  (`getLayerCategories(country)`), `interfaces/LayerCategory.ts` and `GET_CATEGORIES_URL`
  (build-time override with the usual fallback to `NEXT_PUBLIC_API_URL`, so no
  runtime-variable wiring). GC-6 (#140) owns them, with `LayerCategoryIcon`,
  `categoryTints` and `localizedText`, which this page reuses.
- New i18n namespace `methodology` (es and en) for the page's interface texts.
- The cap on the page's static Spanish text (details closed) rises from 1,100 to 1,400
  words for the two new Markdown sections; the API-driven layer content doesn't count.

No API, contract or numeric change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `methodology-documentation`: new section list and order, the generic calculation
  section replaces the deforestation one, new categories, layers-by-country and
  scope-and-limits sections, the page title and subtitle, the word cap, and the link
  between the calculation section and its technical document.

## Impact

- **Web:** `components/page/documentation/` (page layout, side index, new
  `CountryLayersSection` and `LayerLimitsSection` with their tabs and cards),
  `utils/documentation.ts` (sections), `content/documentation/{es,en}/` (new
  `calculation.md`, `categories.md`, `layers.md`, `limits.md`; `deforestation.md`
  removed), `api/layerCategories.ts`, `interfaces/LayerCategory.ts`, `config/env.ts`, a new hook, `locales/{es,en}/methodology.json`,
  `common:documentation` keys, `components/page/landing/LandingSteps.tsx` and their tests.
- **Docs:** `docs/deforestation_calculation.md` names the new Markdown file;
  `apps/web/.env.template` lists the optional `NEXT_PUBLIC_GET_CATEGORIES_URL`.
- **API:** none. Uses `GET /countries`, `GET /categories` (GC-1) and `GET /maps` as they
  are.
- **Shared with GC-6:** the categories client and interface above, agreed by name with
  GC-6 and GC-7 (approved by the user on 2026-11-17).
