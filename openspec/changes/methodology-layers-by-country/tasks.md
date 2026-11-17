## 1. Data access

- [x] 1.1 Add `GET_CATEGORIES_URL` to `config/env.ts` and `NEXT_PUBLIC_GET_CATEGORIES_URL=` to `.env.template`
- [x] 1.2 Add `api/layerCategories.ts#getLayerCategories(country)` and `interfaces/LayerCategory.ts` (same names as GC-6; adopt GC-6's version when it merges)
- [x] 1.3 Add `utils/layerCatalog.ts` (`groupLayersByCategory`, `layerPeriod`) with unit tests (order, unknown category under "other", period fallbacks)
- [x] 1.4 Add `hooks/useCountryLayerCatalog.ts` (parallel fetch, cache per country and language, stale-response guard, retry) with tests mocking `@/api/*`

## 2. Content

- [x] 2.1 Change `DOCUMENTATION_SECTIONS` to calculation, categories, layers, limits, upload, validation, area and update `utils/documentation.test.ts`
- [x] 2.2 Rename `deforestation.md` to `calculation.md` (es, en) and reword it for any layer, keeping Gauss, the worked example, no-data cases and the technical link
- [x] 2.3 Write `categories.md` (polarities, threshold rule with `{{deforestationThreshold}}`, no data, worked example in "More detail") in es and en
- [x] 2.4 Write `layers.md` and `limits.md` (heading, summary, short intro) in es and en
- [x] 2.5 Add the word-cap test (Spanish, details and code removed, ≤ 1,400) and keep the parity, placeholder and block tests green
- [x] 2.6 Point `docs/deforestation_calculation.md`, `apps/web/README.md` and the root `README.md` to the new section files and anchors

## 3. Page

- [x] 3.1 Add the `methodology` namespace (es, en), move the `common:documentation` keys into it and load it in the page
- [x] 3.2 Rework `MethodologyDocument`: hero (eyebrow, title, subtitle), sticky side index from 900 px, top index below, `#deforestation` alias anchor, selected-country state
- [x] 3.3 Add `components/reusable/CategoryIcon.tsx` (icon catalog → MUI icons, fallback)
- [x] 3.4 Add `CountryTabs` (silhouette tabs, initial tab from the session country, never writes it)
- [x] 3.5 Add `CountryLayersSection` (category blocks with polarity, threshold and labels; layer table from 900 px, cards below; empty category; "Other layers"; loading and error with retry)
- [x] 3.6 Add `LayerLimitsSection` (country name, one closed accordion per layer with category chip, considerations Markdown without HTML, references)
- [x] 3.7 Component tests: tabs and session country untouched, grouping rendered, threshold formatting, error and retry, limits accordion, HTML shown as text, alias anchor

## 4. Landing

- [x] 4.1 Point "Ver capas por país" in `LandingSteps.tsx` to `/documentation#layers` and update its test

## 5. Verification

- [x] 5.1 Check the page in the browser at desktop width and at 390 px (es and en, anchors `#layers` and `#deforestation`, tab switching keeps the session country)
- [x] 5.2 Run the web checks: schema check, `tsc --noEmit`, `lint`, `test`, `build`
