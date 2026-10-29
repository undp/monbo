## Context

The web (`apps/web`, Next.js App Router, MUI, react-i18next) has one route per module under `src/app/[locale]/`. Spanish is the default locale, with no prefix (`/polygons-validation`), and English is under `/en/...`. The header (`src/components/reusable/Header/index.tsx`) is a server component with two areas:

- `HeaderNavigation`, which holds the module buttons and the country selector, and on the admin pages replaces them with the session's country;
- `LanguageMenu`, an `IconButton` with the globe icon, which is always shown.

`HeaderButton` returns `null` on the landing and the home, and turns disabled according to the analysis state, so it doesn't suit a link that must always work.

The thresholds come from `GET /config`. `RuntimeConfigGate` (inside `RuntimeConfigBoundary`, in the root layout) renders the pages only once they have loaded. From then on, any client component can read them with `getOverlapThreshold()` and `getDeforestationThreshold()` (`src/config/runtime.ts`). `react-markdown` is already used to show the layers' texts (`MapsDetailsModal`, `LayerForm`).

The page's content comes from the technical sources, rewritten for a cooperative or an EUDR auditor:

- `docs/deforestation_calculation.md`;
- the polygon-validation section of `apps/api/README.md` and its three images in `docs/`;
- the specs `polygon-validation`, `farm-geometry` and `deforestation-analysis`.

## Goals / Non-Goals

**Goals:**

- One page, `/documentation`, with three sections (`#validation`, `#area`, `#deforestation`) in plain language, in Spanish and English.
- The deployment's thresholds shown as the API publishes them, formatted in the user's language.
- A link from the header, beside the language selector, on every page.
- Content that a non-developer can edit as Markdown without touching components.

**Non-Goals:**

- Explaining how the app is used step by step (uploading files, generating the report). This page covers the methods, not a user manual.
- Describing each country's layers. The layer descriptions already live in the admin and in `MapsDetailsModal`.
- Contextual links from each module's results to the page. The anchors make them possible, but they are a later change.
- Rendering LaTeX formulas, a search box, or a CMS.
- Changing any calculation.

## Decisions

### 1. Three Markdown files per language, one per section

```
apps/web/src/content/documentation/
├── es/
│   ├── validation.md
│   ├── area.md
│   └── deforestation.md
└── en/
    └── (the same three files)
```

The page renders each file inside a `<section id="validation|area|deforestation">`. The ids are fixed in code and identical in both languages, so a link to `#deforestation` works in either one.

- *Alternative:* one file per language, with ids generated from its headings by `rehype-slug`. It adds a dependency, and the anchors would change with the language and with every reworded heading.
- *Alternative:* the text in the i18n JSON files. Paragraphs, lists and tables inside JSON strings are hard to edit and to review.

### 2. The Markdown is read on the server; thresholds are filled in on the client

`page.tsx` is a server component. It reads the three files for its `locale` (`fs.readFile` under `process.cwd()`) and passes them as strings to a client component, `MethodologyDocument`.

That component:

1. replaces the placeholders with the thresholds from the runtime configuration;
2. renders each section with `ReactMarkdown`.

The thresholds can only be filled in on the client, since `getOverlapThreshold()` reads the configuration the browser loaded.

The pages are prerendered per locale (`generateStaticParams` in the root layout), so the files are read at build time. In case the route ever renders at runtime, `outputFileTracingIncludes` in `next.config.ts` copies `src/content/documentation/**` into the standalone output.

- *Alternative:* importing the `.md` files as text through a Turbopack loader rule. It needs a `raw-loader`-style dependency and its own configuration in Vitest.
- *Alternative:* `.ts` modules that export template strings. They avoid reading files, but whoever edits the text then edits code (escapes, backticks).

### 3. Placeholders `{{overlapThreshold}}` and `{{deforestationThreshold}}`

A pure function, `fillDocumentationPlaceholders(markdown, language)`, replaces each placeholder with its threshold. It formats the value with `formatPercentage(value / 100, decimals, language)` from `src/utils/numbers.ts`, keeping the threshold's own decimal places (a threshold of 0.5 shows as "0,5 %"). An unknown placeholder is left as written, so a test can catch it.

The 80% cut between MEDIUM and HIGH overlaps is a constant in the API (`helpers.py`), not part of `GET /config`. It is written into the text.

- *Alternative:* i18next interpolation, which uses the same `{{…}}` syntax. It would push the Markdown through `t()`, and its escaping is designed for short strings.

### 4. The header button

An `IconButton` with the `MenuBookOutlined` icon, inside a MUI `Tooltip` whose text is translated (`common:header:documentation`: "Documentación" / "Documentation").

- It is placed before `<LanguageMenu />` and outside `HeaderNavigation`, so it shows on the landing, the home, the modules and the admin pages.
- It is a link (Next `Link` to `localizedPath("/documentation", locale)`) rather than a `router.push`, so it opens in a new tab with a middle click. It has an `aria-label` equal to the tooltip.
- On the documentation page, it takes the active colour of the module buttons (`#03689E` on `#F3FAFD`).

### 5. The page needs no selected country

The route has no `RequireCountry`, so a visitor can read it from the landing before choosing a country. The sections:

- carry `scroll-margin-top` equal to the fixed `AppBar`'s height, so an anchor doesn't leave the heading under the header;
- are preceded by a short index of the three anchors.

### 6. Illustrations

`polygon_overlap_example.png`, `polygon_self_intersection_example.png` and `polygon_few_points_example.png` are copied from `docs/` to `apps/web/public/images/documentation/` and used in the validation section. They are app screenshots with no language-specific text (only Google's map attribution), so both languages share them.

### 7. Two explanations, each pointing to the other

The page is the explanation for users, and `docs/*.md` remains the technical one. Each section of the page ends with a link to the technical document on GitHub, on the `dev` branch: it is the default branch, and the one where `docs/` is updated together with the code. `docs/deforestation_calculation.md` and the README mention the page and where its content lives.

## Risks / Trade-offs

- **[The text drifts from the calculation]**
  - A change to how something is computed may update `docs/` and forget the page.
  - → `docs/deforestation_calculation.md` and the `apps/web` README say that the page's Markdown must change with it. A test checks that `es` and `en` have the same sections and the same placeholders, so at least the two languages can't drift apart.
- **[A hard-coded number goes stale]**
  - The 80% cut and the pixel sizes (30 m, 10 m) are written into the text.
  - → They are constants of the data and of the code, not of the deployment, and the 80% cut is listed among the numbers to review whenever `polygon-validation` changes.
- **[A threshold of 0]**
  - "Overlaps larger than 0%" reads oddly, but it is accurate: with 0, every overlap with an area is reported.
  - → The text is written so that it holds with any value: "larger than {{overlapThreshold}} of the smaller farm's area".
- **[Static reading of files]**
  - If the route stops being prerendered and the files aren't in the standalone output, the page fails in production.
  - → `outputFileTracingIncludes`, plus checking in the `next build` output that `/[locale]/documentation` is prerendered.
- **[An accurate but technical explanation]**
  - Rewriting for non-developers risks losing precision.
  - → The page states what is computed and with what effect, and leaves the libraries and the code to the linked technical document. The text is reviewed against the specs before merging.

## Migration Plan

Nothing to migrate: a new route and a new button. Rolling back means reverting the PR.

## Open Questions

- None. The GitHub links go to `dev` (decided in review). The trade-off: `dev` may describe a calculation that is not yet released, while the page describes the deployed one. Both change together in the same PR, so the gap only lasts until the next release.
- Whether the page also needs a contact or "report an error in the methodology" link. It is left out until there is an address to point it to.
