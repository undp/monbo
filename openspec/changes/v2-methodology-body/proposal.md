## Why

The methodology page got the v2 hero, but its body kept the first version's look: section titles in the body font, a plain "En resumen" box, gray "More detail" blocks, a gray divider between sections and gray body text (`#3A3541`). Next to the stage pages it reads as another product. Its side index also doesn't show where the reader is.

## What Changes

- **Sections as cards:** each section is a stage page's card (`STAGE_CARD`), spaced 24 px apart, instead of sections split by dividers.
- **Section titles:** the heading font, 28 px (24 px on phones), in `ink`, with an icon in a mint tile, as a stage page's section heading: calculation, categories, layers, scope and limits, upload, validation and area each have their own icon.
- **Inner titles** (`h3`) in the heading font, 19 px, `ink`.
- **"En resumen":** the flow's light blue box with a hairline and 12 px corners, its label as the stage pages' green eyebrow, and green bullets.
- **"Más detalle":** a 12 px framed block with the title in `ink` and a blue arrow; its frame turns blue while open.
- **Body text** in `ink2`; links in the flow's blue; formulas on light blue with a blue left edge; images with 12 px corners and a hairline.
- **Considerations** (scope and limits): headings in `ink`, text in `ink2`.
- **Layer tables:** the header band uses the stage tables' `blue25`.
- **Side index:** marks the section being read (blue, bold, blue edge, `aria-current="location"`), followed as the page scrolls.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `methodology-documentation`: a requirement is added for the page's look and its index marking the section being read.

## Impact

- **Web** (`apps/web/src/components/page/documentation/`): `MethodologyDocument.tsx`, `DocumentationMarkdown.tsx`, `methodologyStyles.ts`. No texts, Markdown, API or contract change.
- **Archive order:** after `methodology-layers-by-country`, which has the latest version of the methodology spec. Independent of `v2-buttons-and-modals` and `v2-feedback-and-login`.
