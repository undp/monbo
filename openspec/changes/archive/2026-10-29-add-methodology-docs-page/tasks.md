## 1. Failing tests first

- [x] 1.1 `src/utils/documentation.test.ts` (new), for `fillDocumentationPlaceholders(markdown, language)`:
  - `{{overlapThreshold}}` 1 and `{{deforestationThreshold}}` 2 give "1 %" and "2 %" in `es`, and "1%" and "2%" in `en`;
  - 0.5 keeps its decimal ("0,5 %" / "0.5%");
  - 0 gives "0 %";
  - an unknown placeholder (`{{foo}}`) is left as written;
  - text with no placeholders comes back unchanged.
- [x] 1.2 A content test, reading `src/content/documentation/{es,en}/*.md`:
  - both languages have exactly `validation.md`, `area.md` and `deforestation.md`;
  - each pair of files uses the same set of placeholders, and every placeholder is a known one;
  - no file is empty.
- [x] 1.3 A header test (Testing Library): the book button exists, with the accessible name "Documentación" in `es` and "Documentation" in `en`, and links to `/documentation` and `/en/documentation` respectively.

## 2. Page and content

- [x] 2.1 `src/utils/documentation.ts`: `fillDocumentationPlaceholders`, built on `formatPercentage` and the runtime thresholds (`getOverlapThreshold`, `getDeforestationThreshold`), with the threshold's own decimal places.
- [x] 2.2 Write the Spanish content, `src/content/documentation/es/{validation,area,deforestation}.md`, for non-developers. Sources:
  - the `polygon-validation`, `farm-geometry` and `deforestation-analysis` specs;
  - `docs/deforestation_calculation.md`;
  - the validation section of `apps/api/README.md`.

  Formulas are plain text. The 1 ha example gives 21%. Each section ends with its link to the technical document on GitHub (`dev`).
- [x] 2.3 Write the English content, `src/content/documentation/en/...`, with the same structure and placeholders.
- [x] 2.4 Copy the three example images from `docs/` to `public/images/documentation/` and reference them from `validation.md`.
- [x] 2.5 `MethodologyDocument` (client component): receives the three Markdown strings, fills in the placeholders, and renders each with `ReactMarkdown` in a `<section id=…>`.
  - The sections have `scroll-margin-top` equal to the header's height.
  - An index links to the three anchors.
  - Headings, tables and images follow the app's MUI styles.
- [x] 2.6 `src/app/[locale]/documentation/page.tsx` (server): reads the three files for its locale, loads the `common` translations, and renders `MethodologyDocument`. No `RequireCountry`.
- [x] 2.7 `next.config.ts`: `outputFileTracingIncludes` for `src/content/documentation/**`.

## 3. Header

- [x] 3.1 `common:header:documentation` in `src/locales/{es,en}/common.json` ("Documentación" / "Documentation").
- [x] 3.2 `DocumentationButton` (client):
  - an `IconButton` with `MenuBookOutlined`, inside a `Tooltip`;
  - a Next `Link` to `localizedPath("/documentation", language)`, with an `aria-label` equal to the tooltip;
  - the active colours of the module buttons when the current path is the documentation page.
- [x] 3.3 Place it in `Header/index.tsx` before `<LanguageMenu />`, outside `HeaderNavigation`.

## 4. Technical docs

- [x] 4.1 Write `docs/polygon_area_calculation.md`: the geodesic area on WGS84 (`GeometryCalculator.calculate_polygon_area`), holes and parts, point farms (`get_point_area_and_radius`), and −1 / 0 for invalid and empty polygons.
- [x] 4.2 In `docs/deforestation_calculation.md`, the root README (Docs section) and `apps/web/README.md`, mention the page and name `apps/web/src/content/documentation/` as the user-facing version to update whenever a calculation changes.

## 5. Verify

- [x] 5.1 `pnpm test`, `pnpm lint` and `tsc --noEmit` pass in `apps/web`.

  31 test files and 247 tests pass. `tsc` passes. `lint` reports no errors; its 18 warnings are all in files this change doesn't touch.
- [x] 5.2 `pnpm build`: `/[locale]/documentation` appears as prerendered. Run the standalone build (`pnpm start:standalone`) and check that the page loads.

  `/es/documentation` and `/en/documentation` are prerendered (●). The six Markdown files are traced into `.next/standalone/src/content/documentation/`. The standalone server answers 200 for `/en/documentation` and for the images.

  Run locally, the standalone server answers every Spanish route without a prefix with a 307 to itself (`/`, `/home`, `/documentation` alike), so that loop isn't caused by this change.
- [x] 5.3 With the app running, using the `run` skill and screenshots in `.context/`:
  - open the button from the landing (with no country), from a module and from `/en/admin`;
  - check the tooltip in both languages;
  - open `/documentation#deforestation` and check that the heading is visible below the header;
  - change the API's thresholds (for example `OVERLAP_THRESHOLD_PERCENTAGE=1`, `DEFORESTATION_THRESHOLD_PERCENTAGE=0.5`) and check that the page shows them.

  Checked with the API at `OVERLAP_THRESHOLD_PERCENTAGE=1` and `DEFORESTATION_THRESHOLD_PERCENTAGE=0.5`:
  - the page reads "mayor que 1%" and "mayor que 0,5%" in Spanish, and "greater than 1%" and "greater than 0.5%" in English, with no `{{` left;
  - the button opens the page from the landing and from `/en/admin`, and shows its tooltip in both languages;
  - `/documentation#deforestation` leaves the heading 80 px from the top, below the header;
  - the three images load;
  - switching the language on the page opens `/en/documentation`.
- [x] 5.4 Read the content against the specs. Every number and rule must match `polygon-validation`, `farm-geometry` and `deforestation-analysis`.
