## Context

- `/documentation` (`app/[locale]/documentation/page.tsx`) is a server page: it reads one
  Markdown file per section and language (`utils/documentationContent.ts`,
  `DOCUMENTATION_SECTIONS` in `utils/documentation.ts`) and renders them in the client
  component `MethodologyDocument` with `react-markdown`, `remark-directive` and the
  `:::summary` / `:::details[label]` blocks. Thresholds are placeholders filled from
  `GET /config` (`config/runtime.ts`).
- The header's "Metodología" link (GC-9, `MainNavigation`) already opens the page. The
  landing's step 2 links "Ver capas por país" to `/documentation#deforestation`
  (`components/page/landing/LandingSteps.tsx:108`).
- GC-1 published `GET /categories?country=CC` (`LayerCategory`: localized `name`,
  `description`, `resultLabels`, plus `icon`, `color`, `polarity`, resolved
  `thresholdPercentage`, `temporal`) and `categoryId` on every `GET /maps` layer. Only
  layers whose category resolves and is enabled are public. No web client reads
  categories yet.
- `GET /maps?country=CC&language=xx` already returns every field the mockup's table needs
  except an explicit global/national scope: `coverage` (free text: "Colombia",
  "Superficie terrestre global…", "Zona cafetalera de Costa Rica"), `source`,
  `resolution`, `contentDate`, `updateFrequency`, `considerations` (Markdown) and
  `references`.
- `DataContext` holds `availableCountries` (`GET /countries`) and the session's
  `selectedCountry`; `useAvailableCountries()` returns them named and sorted.
  `getCountryShape(code)` (GC-9) returns a silhouette path in a 100×100 box.
- Mockup v2, `vMetodologia()`: hero with eyebrow and title, a sticky side index, sections
  "Cómo calculamos", "Categorías de capas", "Capas por país" (tabs with silhouettes, one
  block per category with a table of layers), "Alcances y límites" (one card per layer
  with its category chip and its limits), then validation and area.

## Goals / Non-Goals

**Goals:**

- The page reads like the mockup's Methodology view, on desktop and at 390 px.
- Every country's layers, grouped by its categories, straight from the API, so a layer an
  admin publishes appears without a web release.
- Polarity and threshold explained once, in words, and shown per category.
- The session's country is never touched by the page.
- Everything `methodology-documentation` already guarantees keeps holding.

**Non-Goals:**

- Renaming the route `/documentation` or the `documentation` component folder (GC-13).
- An explicit global/national field on layers (needs the admin API and form: GC-2/GC-5).
- Rewording validation, area and upload texts (out of scope by the sub-issue; neutral
  Spanish is GC-11).
- Colors of tiles, the analysis screens and the report (GC-6, GC-7).

## Decisions

### 1. Seven sections, Markdown first, live content appended

`DOCUMENTATION_SECTIONS` becomes `calculation`, `categories`, `layers`, `limits`, `upload`,
`validation`, `area`: the mockup's order (calculation, categories, layers, limits, then
how farms are checked), with upload placed before validation because it is stage 1's
first step. Every section keeps a Markdown file with its heading and "En resumen", so
the index titles, the summary rule, the parity tests and the word count apply unchanged.
`layers` and `limits` render a client component after their Markdown
(`CountryLayersSection`, `LayerLimitsSection`). The page holds the selected country in
`MethodologyDocument` state and passes it to both.

`deforestation.md` becomes `calculation.md`. An empty `<span id="deforestation">` at the
top of the calculation section, with the same scroll margin, keeps old links working.

*Alternative:* keep the id `deforestation`. Rejected: the section is now generic, and the
alias costs one element.

### 2. Tabs with silhouettes, local state only

The tabs are MUI `Tabs` (`variant="scrollable"`, keyboard and ARIA from MUI) with the
silhouette as the tab icon, filled with `currentColor`. Initial tab: `selectedCountry`
when it is in `availableCountries`, else the first by name; computed until the user picks
one, so a session country that hydrates late still wins. Choosing a tab only sets local
state: the component never calls `setSelectedCountry` or `useCountryChange` (a test spies
on them).

### 3. One hook fetches a country's catalog, cached for the page's life

`hooks/useCountryLayerCatalog.ts` takes `(country, language)` and returns
`{ status: "loading" | "error" | "ready", categories, maps, retry }`. It calls
`getLayerCategories(country)` (`api/layerCategories.ts`, shared with GC-6) and `getMaps(language, country)` in
parallel, caches the result per `country:language` in a `Map` held by the hook (a ref), so
the cache lives as long as the page and a new visit fetches again; a failed request
leaves the cache and is logged. It ignores responses for a country that is no longer
selected. `MethodologyDocument` calls it once and passes the state to both sections.

The page needs one country per tab, so it never reads GC-6's `availableCategories` from
`DataContext` (only the session country's). The client, `interfaces/LayerCategory.ts` and
`GET_CATEGORIES_URL` are GC-6's (#140), by agreed names, and this unit uses them as they
are.

`GET_CATEGORIES_URL` follows `GET_COUNTRIES_URL`: `NEXT_PUBLIC_GET_CATEGORIES_URL`
(build-time) falling back to `${NEXT_PUBLIC_API_URL}/categories`. No runtime variable is
added, so `entrypoint.sh` and Terraform don't change; `.env.template` lists the override.

### 4. Grouping is a pure function

`utils/layerCatalog.ts#groupLayersByCategory(categories, maps)` returns
`[{ category, layers }]` in the categories' order, then `{ category: null, layers }` for
layers whose `categoryId` is unknown ("Otras capas"), and is unit-tested. A layer is never
placed under a category it doesn't name, and an unknown category never gets a polarity
or threshold by guess. `layerPeriod(map)` returns the analysis window
(`baseline → comparedAgainst`) and, apart, the dataset's range (`contentDate`): the
window is what backs a due diligence (the loss after the 2020 baseline), and
`contentDate` ("Datos entre 2000 y 2023") alone read as if the loss counted since 2000
(review of #139).

### 5. "Alcance" shows the layer's coverage text

The mockup's "Alcance" column is a Global/Nacional tag, but layers carry no such field,
and in the per-country layout GFW and TMF are copies inside each country, so it can't be
derived. The column shows `coverage` under the heading "Cobertura" ("Coverage"): the
admin already writes it per layer and it tells more (a coffee zone, global land surface).
An explicit scope field is a follow-up for GC-2/GC-5.

*Alternative:* infer "Global" from names (GFW, TMF). Rejected: a wrong label in an audit
document is worse than a descriptive one.

### 6. Category visuals

A category looks the same here as in the territorial analysis (GC-6): its icon is GC-6's
`LayerCategoryIcon`, its colors come from `categoryTints` (`utils/categoryColors.ts`: the
API `color` for the icon and a left border, a 12% tint behind), the result chips use
`resultClassColor` / `resultClassBackgroundColor` (`utils/styling.ts`), and texts go
through `localizedText`. A layer whose category isn't published gets the generic icon in
the grey of a missing category. Polarity reads "Marca lo que se debe evitar" / "Marca lo
permitido", and each chip states its rule ("dentro/fuera de la capa: ≤ / > umbral"), so
color is never the only signal.

### 7. Layout

- `MethodologyDocument` gets the mockup's hero (eyebrow, title, subtitle) and a two-column
  grid from `md` (900 px): a sticky index (`position: sticky`, below the 64 px header) and
  the content (max 880 px). Below `md` the index is the existing box above the content.
- Layer table from 1100 px; below it, one bordered card per layer with label/value rows. Between 900 and 1100 px the side index leaves the content too narrow for six columns without scrolling (review of #139), so the cards start at 1100 px rather than at `md`.
  The table sits in a horizontally scrollable container as a last resort so long sources
  never widen the page.
- Considerations: one MUI `Accordion` per layer, closed, rendering the Markdown with the
  page's components minus `img` (headings mapped down to `h4` size). `react-markdown`
  without `rehype-raw` shows HTML as text. Only `http(s)` addresses are links, in the
  considerations and in the references (`isWebUrl`); anything else (`javascript:`, a
  path of the app, `mailto:`) is plain text, since a country's admin writes them.
- Anchors: the page scrolls to the URL's anchor when it mounts (it renders after
  `GET /config`, too late for the browser), and once more when the country's catalog
  settles and the layers section changes height, unless the reader has scrolled.
- A category's two result chips state their rule on what is compared with the
  threshold: the share inside the layer ("what to avoid") or outside it ("what is
  allowed"). The calculation section gives no category's threshold as a number, only
  the fallback, and points to each country's tab (review of #139).

### 8. Texts

- Markdown: `calculation.md` (reworded from `deforestation.md`), new `categories.md`,
  `layers.md` and `limits.md` (heading, summary and one short paragraph each), in `es` and
  `en`. `{{deforestationThreshold}}` stays the only threshold placeholder.
- Interface strings in a new `methodology` namespace (`locales/{es,en}/methodology.json`),
  loaded by the page next to `common`: hero, tabs, table headers, polarity, states.
  The four `common:documentation` keys move there; `common` keeps nothing for the page.
  A new namespace keeps the other units' locale edits from colliding with this one.
- The word cap (spec) is checked by a new test in `utils/documentation.test.ts` that
  strips `:::details` blocks and fenced code and counts words: 1,400.

## Risks / Trade-offs

- [A category drawn differently on two screens] → This page reuses GC-6's icon, tints,
  result colors and `localizedText` instead of its own (review of #139, nit 3).
- [A country with many layers makes the page long] → The limits are collapsed, and the
  tables are compact; acceptable for today's 2–4 layers per country.
- [`coverage` is not "Global/Nacional"] → Decision 5; the mockup is not yet revalidated
  (D10), and a field can be added later without changing this layout.
- [The tab content depends on the API] → Loading and error states are local to the two
  sections; the static methodology always renders.
- [Old deep links to `#deforestation`] → Kept by the alias anchor.

## Migration Plan

Web only, no data or contract change. Ships with the integration PR
`feat/layer-manager` → `dev`. Rollback is reverting the commit.

## Open Questions

None. Gate 1 answers (2026-11-17, user: "apruebo todo según las recomendaciones"): the
"Alcance" column shows `coverage` under "Cobertura", with an explicit Global/National field
as a follow-up for GC-2/GC-5 (decision 5); the mockup's section order (decision 1); the
categories client shared with GC-6 by the names above.
