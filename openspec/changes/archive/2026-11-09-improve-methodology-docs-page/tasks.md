## 1. Failing tests first

- [x] 1.1 In `src/utils/documentation.test.ts`, update the content test:
  - both languages have exactly `upload.md`, `validation.md`, `area.md` and `deforestation.md`;
  - `DOCUMENTATION_SECTIONS` is `["upload", "validation", "area", "deforestation"]`.
- [x] 1.2 Add a directives test, parsing every file with `remark-parse` + `remark-directive` (add `remark-parse` and `unified` as dev dependencies if pnpm doesn't resolve them from `react-markdown`):
  - each section has exactly one `:::summary`, right after its `##` heading;
  - Spanish and English have the same number of `:::details` blocks per section, each with a non-empty label;
  - any container directive other than `summary` or `details` fails.
- [x] 1.3 Add tests for `remarkDocumentationBlocks`:
  - `:::summary` and `:::details[label]` become elements with `data-block` and the label;
  - a text directive such as `ratio:valor` comes back as its original text.
- [x] 1.4 Add a component test (Testing Library) for `MethodologyDocument`:
  - the index lists four sections, in order;
  - every "Más detalle" block is closed, and opens with a click and with Enter;
  - a placeholder inside a details block is replaced by its threshold.

## 2. Rendering

- [x] 2.1 Add `remark-directive` to `apps/web`.
- [x] 2.2 Write `src/utils/remarkDocumentationBlocks.ts`, which turns `summary` and `details` container directives into elements marked with `data-block` (and `data-label`), and text or leaf directives back into their text.
- [x] 2.3 In `MethodologyDocument`:
  - pass `remarkPlugins={[remarkDirective, remarkDocumentationBlocks]}`;
  - render `data-block="summary"` as a highlighted box titled with `common:documentation:summary`;
  - render `data-block="details"` as a closed MUI `Accordion`, whose summary is the label.
- [x] 2.4 `src/utils/documentation.ts`: add `upload`, first, to `DOCUMENTATION_SECTIONS`.
- [x] 2.5 `src/locales/{es,en}/common.json`:
  - `documentation.summary`: "En resumen" / "In short";
  - a `documentation.subtitle` that names the four topics.

## 3. Diagrams

- [x] 3.1 `public/images/documentation/loss_pixel_partial.svg`: a 30 × 30 pixel cut by the farm's edge, with the 300 m² piece shaded and its corners labelled (0,0), (30,0), (30,5), (0,15). Numeric labels only.
- [x] 3.2 `public/images/documentation/gauss_area_formula.svg`: the same piece, with the triangles each edge forms with the origin, shaded by sign. Numeric labels only.

## 4. Content (Spanish first, then English with the same structure)

- [x] 4.1 Write `es/upload.md` (new):
  - summary;
  - the four ways to upload and when each one fits (a table);
  - the formats;
  - the accepted geometry, moved from validation;
  - a point's area by way of upload (1 ha by default, required when drawing);
  - "Más detalle": the accepted attribute names, the reprojection, the Shapefile without `.prj`, and the 20 MB / 200 MB limits;
  - the link to `docs/architecture.md#how-farms-come-in`.

  Don't repeat the cards' steps.
- [x] 4.2 Rewrite `es/validation.md`:
  - summary and question-style subheadings;
  - the accepted geometry replaced by a link to `#upload`;
  - in "Más detalle": MultiPolygons, holes, a point as a circle, and one overlap per pair.
- [x] 4.3 Rewrite `es/area.md`:
  - summary;
  - the ellipsoid line ("the same idea as Gauss's formula, on the curved Earth"), with a link to `#deforestation`;
  - a point's area pointing to `#upload`;
  - the circle's figures (1.5% at 10°, 13% at 30°) in "Más detalle".
- [x] 4.4 Rewrite `es/deforestation.md`:
  - summary;
  - the percentage, with the `loss_pixel_partial.svg` diagram;
  - "¿Cómo se mide cada superficie?", with Gauss's formula, its intuition and `gauss_area_formula.svg`;
  - the 1 ha example (21%);
  - the threshold, the cases with no result, and the limit of the method;
  - "Más detalle": the 300 m² computation edge by edge, and why measuring in the layer's coordinates doesn't distort the ratio.
- [x] 4.5 Write `en/upload.md` and rewrite `en/validation.md`, `en/area.md` and `en/deforestation.md`, with the same blocks and placeholders as Spanish.
- [x] 4.6 Check the length: with the "Más detalle" blocks left out, the four Spanish files add up to at most 1,100 words.

## 5. Technical docs

- [x] 5.1 `docs/architecture.md`, "How farms come in": name `apps/web/src/content/documentation/{es,en}/upload.md` as the user-facing version to update with it.
- [x] 5.2 `docs/deforestation_calculation.md`: say that the page explains Gauss's formula with the same 300 m² example.
- [x] 5.3 `apps/web/README.md`, "Documentation page":
  - four files;
  - the `:::summary` / `:::details[...]` syntax and the test that guards it.

  `README.md` and `apps/api/README.md` keep their current links.
- [x] 5.4 Add a `CHANGELOG.md` entry.

## 6. Verify

- [x] 6.1 `pnpm test`, `pnpm lint` and `tsc --noEmit` pass in `apps/web`.
- [x] 6.2 `pnpm build`: `/[locale]/documentation` is still prerendered, and `upload.md` is traced into the standalone output.
- [x] 6.3 With the app running (`run` skill, screenshots in `.context/`):
  - `/documentation` and `/en/documentation` show four sections with their summaries;
  - the "Más detalle" blocks open and close with the mouse and the keyboard;
  - `#upload` and `#deforestation` scroll below the header;
  - the SVGs render in both languages;
  - the thresholds appear inside and outside the blocks.
- [x] 6.4 Review the text with the `estilo:redaccion` criteria (short sentences, active voice, no unexplained jargon), and check every figure against the code: the 21% example, 300 m², the 80% cut, 1 ha, 1.5% / 13%, 20 MB / 200 MB.
