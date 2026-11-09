## Context

The documentation page came in with `add-methodology-docs-page` (#88):

- `src/app/[locale]/documentation/page.tsx` reads one Markdown file per section and language (`readDocumentation`, `src/utils/documentationContent.ts`);
- `MethodologyDocument` fills in the thresholds and renders each file with `react-markdown`, mapping `h2`, `h3`, `p`, `ul`, `li`, `pre`, `a` and `img` to MUI;
- the sections, and their anchors, are `DOCUMENTATION_SECTIONS` in `src/utils/documentation.ts`. The index takes each title from the file's first heading;
- `documentation.test.ts` checks that both languages have the same sections and the same known placeholders.

Two things changed after it:

- **#97 changed the upload.** Farms now come in four ways (Excel, geo file with its data, geo file + Excel by ID, drawn on the map) and from GeoJSON, KML, KMZ and zipped Shapefiles. The page still says "WKT or GeoJSON" and "the area declared in the template".
- **The page reads as a reference.** Each section gives the main rule and the edge cases the same weight, in about 1,600 words in Spanish. Its two readers want different things: a cooperative wants to know what to fix, and an EUDR auditor wants to check how a number is computed.

The page never says how an area is computed. The code uses two methods:

| What is measured | How | Where |
|---|---|---|
| The farm's hectares (tables, report, overlaps) | Geodesic area on the WGS84 ellipsoid, `pyproj.Geod.geometry_area_perimeter` (Karney's algorithm) | `GeometryCalculator.calculate_polygon_area` |
| Both areas of the deforestation percentage: each loss pixel's piece inside the farm, and the farm | `shapely.area`, the planar shoelace formula (Gauss's area formula), in the raster's CRS | `get_loss_area_fraction`, `deforestation_analysis/helpers.py` |

So Gauss's formula is exact to name for the deforestation percentage. It would be wrong for the hectares.

## Goals / Non-Goals

**Goals:**

- A fourth section, first in the page, on how farms are uploaded, which brings the page in line with #97.
- One pattern per section: a summary box, a short body, collapsible details, and the technical link.
- Gauss's formula explained where it is used (the deforestation percentage), and told apart from the hectares.
- At most 1,100 words of visible Spanish text with the details closed, against about 1,600 today for three sections.
- Diagrams that serve both languages.

**Non-Goals:**

- A step-by-step upload manual. Each upload card in the app already gives its steps, templates and examples. The section says which card to use and what it accepts.
- Changing any calculation, validation or upload rule.
- Math rendering (KaTeX, MathJax). Formulas stay as plain text in fenced blocks.
- Contextual links from the modules to the page's anchors.
- A search box, a CMS, or a "print the whole page" mode (see Open Questions).

## Decisions

### 1. `upload` is a fifth Markdown file and the first section

`DOCUMENTATION_SECTIONS` becomes `["upload", "validation", "area", "deforestation"]`. `readDocumentation` and the index already iterate over that list, so they need no change. The page's subtitle (`common:documentation:subtitle`) names the four topics.

The "accepted geometries" part of `validation.md` moves to `upload.md`. Validation links to `#upload` instead, so the page states each rule once.

The technical link is `docs/architecture.md#how-farms-come-in`, the section #97 wrote. No new technical document is created.

- *Alternative:* keep the formats inside validation. Validation is an optional module, though, and its section would then talk about how to upload for the deforestation analysis too.

### 2. Summaries and collapsible blocks are container directives

```markdown
## Cálculo de la deforestación

:::summary
- Monbo mide qué parte de la finca está sobre píxeles con pérdida de bosque.
- Un píxel que la finca cubre en parte cuenta solo por esa parte.
- Sobre {{deforestationThreshold}}, la finca se muestra con deforestación.
:::

…cuerpo…

:::details[Más detalle: la fórmula de Gauss paso a paso]
…
:::
```

The web adds `remark-directive` and a small remark plugin of its own, `remarkDocumentationBlocks`, in `src/utils/`. The plugin turns:

- `:::summary` into an element that `MethodologyDocument` renders as a highlighted box, titled "En resumen" / "In short" (from `common:documentation`);
- `:::details[label]` into an element that renders as a MUI `Accordion`, closed, with the label as its summary. The Accordion gives keyboard and ARIA behaviour (`aria-expanded`, `aria-controls`) at no extra cost.

The plugin marks the element with a data attribute (`data-block="summary|details"`) and the label. `markdownComponents` dispatches on that attribute, so `react-markdown`'s `Components` type needs no custom tag names.

The placeholders are filled in on the raw Markdown before it is parsed, as today, so a threshold inside a "More detail" block is replaced too.

- *Alternative:* `rehype-raw` and `<details>` written in the Markdown. It lets any HTML into the content, styling `<details>` to look like the rest of the app takes more work, and the editors would write HTML.
- *Alternative:* split each section into several files (summary, body, details). It multiplies the files by three and breaks the reading order of a section into pieces.
- *Alternative:* a custom marker such as `<!-- details -->`, parsed by hand. It is a home-made syntax with no parser behind it.

### 3. Unknown directives fail a test

`remark-directive` also parses text directives (`:name`) and leaf directives (`::name`). Text like `EPSG:4326` doesn't match, since a directive's name must start with a letter, but `ratio:valor` would. The plugin:

- renders any text or leaf directive back as the text it came from, so the page never loses words;
- leaves other container directive names to a test: `documentation.test.ts` parses every file with `remark-parse` + `remark-directive` and fails on any directive that isn't `summary` or `details`.

The same test checks that each section has exactly one summary, right after its heading, and that Spanish and English have the same number of `details` blocks per section.

### 4. Gauss's formula: what goes in the body, what in "More detail"

**Body** (deforestation, a subsection "¿Cómo se mide cada superficie?"):

- every piece of a loss pixel inside the farm, and the farm, is a polygon given by its corners;
- its area comes from Gauss's area formula, also called the shoelace formula, written as plain text;
- why it works: each edge, with the origin, forms a triangle that adds when the edge goes one way and subtracts when it goes back. The parts outside the polygon are added once and subtracted once, so only the inside remains. That is why it measures any shape, including the irregular piece of a cut pixel;
- the Gauss diagram.

**More detail:** the 300 m² piece of the existing example, with corners (0, 0), (30, 0), (30, 5), (0, 15), computed edge by edge (0 + 150 + 450 + 0 = 600; ½ · 600 = 300 m²). It reuses the page's own example, so the auditor can follow the whole 21% by hand.

**Area section:** one sentence. The hectares are measured on the ellipsoid by adding, for each edge, the area between the edge and the equator: the same idea, on the curved Earth. A link to `#deforestation` points to the formula.

### 5. Two SVG diagrams, numeric labels only

`public/images/documentation/`:

- `loss_pixel_partial.svg`: a 30 × 30 m pixel cut by the farm's edge, with the inside piece shaded, the corners of the 300 m² trapezoid labelled with their coordinates, and the pixel's side;
- `gauss_area_formula.svg`: the same trapezoid with the triangles from the origin, shaded by sign.

The labels are numbers and coordinates only, so one file serves both languages. Each image's alt text, in the Markdown, carries the language. They are hand-written SVG, small and reviewable in a diff. The `img` mapping already shows them at up to 480 px wide.

- *Alternative:* PNG, like the validation images. They are harder to edit, and text in them would need one image per language.

### 6. Writing for two readers

- Each section's first lines (the summary) answer the cooperative's question: what Monbo checks or computes, and what makes a farm fail.
- Subheadings are the users' questions ("¿Por qué mi finca aparece como no válida?", "¿Por qué aparece N/D?").
- "More detail" holds what an auditor checks: the formulas worked out, MultiPolygons and holes, the circle's figures by latitude, the accepted attribute names, the size limits.
- The style follows the current page: short sentences, active voice, no jargon without an example. The word count with the details closed is checked by hand (task 4.6). It isn't a test, since a test would fail on a well-written addition.

## Risks / Trade-offs

- **Closed blocks hide content from the browser's find (Ctrl+F) and from printing.** → The essential rules stay in the body. Only the explanation of a rule goes into "More detail". The Accordion keeps its content mounted (MUI's default), so the text stays in the HTML for indexing.
- **A new dependency (`remark-directive`).** → It belongs to the unified/remark ecosystem `react-markdown` is built on, and it depends only on the matching micromark and mdast extensions. The alternative, raw HTML, is worse for the content's safety and for its editors.
- **The upload section can drift from the upload cards.** → It doesn't repeat the cards' steps. It only names the four ways, the formats and the rules. `docs/architecture.md` names `upload.md` as the version to update with it.
- **Two methods for "area" can confuse an auditor.** → The area section says it explicitly and points to the deforestation section, which says why the ratio doesn't need the ellipsoid (the distortion cancels at a farm's scale; in "More detail").

## Migration Plan

Web only. It deploys with the next release of `dev`. Rolling back the PR restores the three-section page. The `#validation`, `#area` and `#deforestation` anchors are unchanged, so existing links keep working.

## Open Questions

- Should the page offer "Expand all" for printing, or a print style that opens every block? Left out for now. Revisit if auditors ask to print it.
