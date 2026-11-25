## Context

`MethodologyDocument` renders the hero, a side index and one section per Markdown file (`content/documentation/`), through `DocumentationMarkdown`, which maps each Markdown element to MUI. The hero already uses the v2 tokens; the body used the first version's colors. The stage pages' tokens are in `flow/flowStyles.ts`.

## Goals / Non-Goals

**Goals:** the body reads as the stage pages; the index shows where the reader is.

**Non-Goals:** the texts and Markdown; the hero; the layer tables' layout (already v2) and the country tabs.

## Decisions

### D1: A card per section

The sections are long, and a divider between them was easy to miss while scrolling. A card per section, as the stage pages group their content, marks where each starts. The card keeps the section's `id` and `scrollMarginTop`, so the anchors land as before.

### D2: The section icon goes through the heading renderer

The title is the Markdown's `h2`, so the icon can't be placed beside it from outside. `DocumentationMarkdown` takes an optional `icon` and, with it, renders the `h2` as a row with a mint tile (`SECTION_ICON_TILE`, which `FlowSection` also uses). The icon per section is a map in `MethodologyDocument` (`SECTION_ICONS`), typed by `DocumentationSection`, so a new section fails to compile until it has one.

### D3: The index follows the scroll

`useCurrentSection` (`hooks/`, one hook per file) marks the last section whose top has passed under the fixed header (`SCROLL_MARGIN_TOP` plus 40 px). Once the page is scrolled to its end it marks the last section: the last one ("Superficie de las fincas") is short and, on a tall window (1920×1080), its top never reaches the header, so it was never marked. It listens to scroll and resize, at most one update per frame (`requestAnimationFrame`); an `IntersectionObserver` was dropped, since its band didn't match the rule and the scroll listener decided anyway. The marked link gets `aria-current="location"`.

### D4: The old anchor at the card's edge

`#deforestation` (the calculation section's former id) is a span inside the card. Inside the padding it landed 28 px lower than `#calculation`, with the card's edge under the header; positioned at the card's top edge (`position: absolute`), it lands as `#calculation` does.

## Risks / Trade-offs

- [The card's padding narrows the layer tables] → They wrap one more line in some cells; below 1100 px of window they are already cards.
- [Scroll listener cost] → One `getBoundingClientRect` per section (seven) per frame at most, on a passive listener.
- [The eyebrow's contrast] → `PageEyebrow`'s green on `blue25` is 3.8:1 at 12 px, under AA; it is the stage pages' eyebrow (4.0:1 on white), so it goes to the refactor list as one token for every eyebrow.

## Migration Plan

None: a web-only change, deployed with the next merge into `dev`.
