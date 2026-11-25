## Why

The documentation page (`/documentation`, #88) explains how farms are validated, measured and analysed, but it reads like a reference: about 1,600 words in Spanish, with the rule a cooperative needs and the edge case an auditor checks given the same weight. It is also out of date. Since #97 farms come in four ways (Excel, geo file with its data, geo file + Excel, drawing on the map) and from GeoJSON, KML, KMZ and Shapefiles, while the page still says "WKT or GeoJSON" and "the area declared in the template". And it never says how an area is actually computed: the deforestation percentage measures every piece of a loss pixel, and the farm, with Gauss's area formula (the shoelace formula), which an auditor may want to check by hand.

## What Changes

- A **new first section, "Farm upload"** (`#upload`): the four ways to upload farms and when to use each, the accepted formats and geometries, and where a point farm's area comes from. The "accepted geometries" part moves here from the validation section.
- The sections are, in order: **upload, validation, area, deforestation**. The index lists four.
- **Every section follows one pattern**, for its two readers:
  - an **"In short"** box at the top, with 2–3 points, for cooperatives;
  - a short body, with subheadings phrased as the user's questions;
  - collapsible **"More detail"** blocks for auditors: formulas worked through, edge cases, exact figures;
  - the link to its technical document, at the end.
- **Deforestation** explains that both areas of the percentage are measured with **Gauss's area formula**, with its intuition and a diagram in the body, and the 300 m² piece of the existing example computed step by step in "More detail".
- **Area** gets one line saying the hectares are measured on the ellipsoid, the same idea as Gauss's formula on the curved Earth, so a reader doesn't assume the formula applies there. The point circle's figures match the technical document (1.5% at 10°, 13% at 30°).
- Two **diagrams** (SVG, numeric labels only, so one file serves both languages): a loss pixel cut by the farm's edge, and the Gauss polygon.
- The visible text (with "More detail" closed) aims at about **1,000 words in Spanish for four sections**, against about 1,600 today for three.

## Capabilities

### New Capabilities

<!-- None. -->

### Modified Capabilities

- `methodology-documentation`:
  - four sections instead of three, with the new upload section first;
  - each section's summary and collapsible details;
  - Gauss's formula in the deforestation section;
  - the ellipsoid line in the area section;
  - the accepted geometries moved from validation to upload;
  - the upload section's link to its technical document.

## Impact

- **Web** (`apps/web`):
  - `src/content/documentation/{es,en}/`: a new `upload.md`, and the other three files rewritten;
  - `src/utils/documentation.ts`: the section list;
  - `src/components/page/documentation/MethodologyDocument.tsx`: rendering the summary box and the collapsible blocks;
  - two SVGs in `public/images/documentation/`;
  - `documentation.test.ts`, extended.
- **Dependencies:** `remark-directive`, added to the web, so the Markdown can mark a summary and a collapsible block without raw HTML.
- **API:** none. The page describes the existing behaviour without changing it.
- **Docs:**
  - `docs/architecture.md` ("How farms come in") points to `upload.md` as its user-facing version;
  - the web README lists four files;
  - `docs/deforestation_calculation.md` names the page's Gauss explanation.
