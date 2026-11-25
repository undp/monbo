## Why

The web shows a farm as `NOT_VALID`, an overlap as 34%, or a deforestation of 21%, but never says how those numbers come about. A cooperative that has to fix its farms, or an EUDR auditor who has to trust the report, has no way to find out from the app. The explanation exists only for developers: `docs/deforestation_calculation.md`, the API's README and the OpenSpec specs, in English and in terms of `rasterio` and `shapely`.

## What Changes

- A new **documentation page** in the web, at `/documentation` (`/en/documentation` in English), written for the app's users rather than its developers, in Spanish and English. It has three sections, each with its own anchor:
  - **Polygon validation** (`#validation`): the accepted formats, the geometries that make a farm invalid (empty, fewer than 3 points, self-intersection, a hole outside its farm, parts that overlap each other), and how overlaps between farms are measured, reported and graded.
  - **Farm area** (`#area`): the area is measured on the Earth's ellipsoid, holes are subtracted and parts added, and a farm given as a point is taken as a circle with its declared area.
  - **Deforestation** (`#deforestation`): the share of the farm's area on the layer's loss pixels, how a pixel the farm only partly covers counts, a worked example, when a farm gets no result, and the limit set by each layer's resolution.
- The page states the **overlap and deforestation thresholds of the current deployment**, read from the configuration the web already loads from `GET /config`, never written into the text.
- A **book icon button with a tooltip** in the header, next to the language selector, opens the page. It is shown on every page: the landing, the modules and the admin pages.
- The page's text lives in one Markdown file per language, rendered with `react-markdown` (already a dependency). Formulas are written as plain text, so no math rendering library is added.
- `docs/deforestation_calculation.md` remains the technical reference. The page and the repository's docs point to each other, and the empty `docs/polygon_area_calculation.md` gets its technical content.

## Capabilities

### New Capabilities

- `methodology-documentation`: the user-facing page that explains polygon validation, farm area and the deforestation calculation; how it is reached from the header; its languages; and how it shows the deployment's thresholds.

### Modified Capabilities

<!-- None: the page describes existing behaviour without changing it. -->

## Impact

- **Web** (`apps/web`):
  - new route `src/app/[locale]/documentation/`;
  - Markdown content per locale;
  - a new header button beside `LanguageMenu` in `src/components/reusable/Header/index.tsx`;
  - translations for the button's tooltip and the page's title;
  - unit tests (Vitest) for the threshold interpolation.
- **API**: none. The page only reads `GET /config`, which already exists.
- **Dependencies**: none added.
- **Docs**: a link from `docs/deforestation_calculation.md` and the README to the page, and the content of `docs/polygon_area_calculation.md`.
- **Maintenance**: when a calculation changes, its explanation now lives in two places (the technical doc and the page). Keeping both in step becomes part of that change's tasks.
