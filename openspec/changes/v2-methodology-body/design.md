## Context

`MethodologyDocument` renders the hero, a side index and one section per Markdown file (`content/documentation/`), through `DocumentationMarkdown`, which maps each Markdown element to MUI. The hero already uses the v2 tokens; the body used the first version's colors. The stage pages' tokens are in `flow/flowStyles.ts`.

## Goals / Non-Goals

**Goals:** the body reads as the stage pages; the index shows where the reader is.

**Non-Goals:** the texts and Markdown; the hero; the layer tables' layout (already v2) and the country tabs.

## Decisions

### D1: A card per section

The sections are long, and a divider between them was easy to miss while scrolling. A card per section, as the stage pages group their content, marks where each starts. The card keeps the section's `id` and `scrollMarginTop`, so the anchors land as before.

### D2: The section icon goes through the heading renderer

The title is the Markdown's `h2`, so the icon can't be placed beside it from outside. `DocumentationMarkdown` takes an optional `icon` and, with it, renders the `h2` as a row with a mint tile (the stage pages' section tiles). The icon per section is a map in `MethodologyDocument` (`SECTION_ICONS`), typed by `DocumentationSection`, so a new section fails to compile until it has one.

### D3: The index follows the scroll

`useCurrentSection` marks the last section whose top has passed under the fixed header (`SCROLL_MARGIN_TOP` plus 40 px), recomputed on scroll and when a section crosses the band an `IntersectionObserver` watches. Without `IntersectionObserver` (jsdom, old browsers) nothing is marked, as before. The marked link gets `aria-current="location"`.

## Risks / Trade-offs

- [The card's padding narrows the layer tables] → They wrap one more line in some cells; below 1100 px of window they are already cards.
- [Scroll listener cost] → One `getBoundingClientRect` per section (seven) per scroll event, passive.

## Migration Plan

None: a web-only change, deployed with the next merge into `dev`.
