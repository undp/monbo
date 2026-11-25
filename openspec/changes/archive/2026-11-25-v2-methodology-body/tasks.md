## 1. Sections

- [x] 1.1 `MethodologyDocument`: each section a `STAGE_CARD`, no dividers; the page's text in `ink`, paragraphs in `ink2`
- [x] 1.2 `SECTION_ICONS` and `DocumentationMarkdown`'s `icon`: the title with its tile, in the heading font
- [x] 1.3 `#deforestation` at the calculation card's top edge

## 2. Markdown pieces

- [x] 2.1 `h3`, paragraphs, lists, links, formulas and images with the v2 tokens
- [x] 2.2 "En resumen" (`PageEyebrow`, green bullets) and "Más detalle" (framed block, blue arrow); links' underline with `alpha()`; `SECTION_ICON_TILE` shared with `FlowSection`
- [x] 2.3 Considerations' headings and text; the layer tables' header band in `blue25`

## 3. Index

- [x] 3.1 `useCurrentSection`: the section being read, marked in the index with `aria-current`
- [x] 3.2 Review fixes: the hook in `hooks/`, scroll and resize only (one update per frame), the last section at the page's end; tests for the hook (start, scroll, end)

## 4. Verification

- [x] 4.1 `pnpm exec tsc --noEmit`, `pnpm run lint`, `pnpm test` and `pnpm run build` in `apps/web`
- [x] 4.2 `openspec validate v2-methodology-body --strict`
- [x] 4.3 Screenshots at 1440×900 of every section, with a "Más detalle" open, before and after
- [x] 4.4 By hand in the browser: the page in both languages, the anchors (e.g. `/documentation#layers`), the index while scrolling, and a phone
