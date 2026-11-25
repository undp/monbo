## Context

The v2 screens style their MUI controls with `sx` (`FLOW_COLORS`, `HEADING_FONT`); the theme has no component overrides, so whatever a screen didn't restyle keeps MUI's defaults. `manual-farm-modal-v2` chose local styles over a theme override (its D1) because screens not yet on v2 would change too. After the stage pages, the landing, the admin and the drawing modal moved to v2, the default look is what is left over.

## Goals / Non-Goals

**Goals:** every button reads as v2 without each screen restyling it; the modals share one heading, paper and footer.

**Non-Goals:** the remaining pieces listed in the proposal; changing `palette.primary` (checkboxes, links and focus rings would change too); removing the now redundant `sx` of buttons already styled by hand.

## Decisions

### D1: Buttons in the theme

`MuiButton.styleOverrides.root` sets sentence case, the corners, the weight and no shadow, and uses `variants` for the primary colors: contained `landing.blue` (`#0d64a0`, hover `landing.blueDark`), outlined `landing.blue` on white with a `#b6c6d6` border (1.74:1, as MUI's default; `FLOW_COLORS.fieldLine`), text `landing.blue`. The values come from `palette.landing`, so `config/` doesn't import from `components/`. MUI's `.Mui-disabled` rules are more specific and still apply.

*Alternative:* change `palette.primary.main` to `#0d64a0`. Rejected here: it reaches every primary control, a wider review than this change.

### D2: One reusable heading

`ModalHeader` (from `manual-farm-modal-v2`, its D5) keeps only the title in the `DialogTitle` (an `h2`), so a dialog is named by its title alone. New: the icon is optional, `tone` colors its tile (`blue`, `warn`, `bad` from `FLOW_COLORS`), the close button appears only with `onClose` (the overlaps and geometry modals close from their own button), and the title may be a node (the overlaps modal keeps its map color dot).

### D3: `BaseModal` owns the footer

`BaseModal` gets `actions`, rendered in `MODAL_FOOTER` (right-aligned, over a hairline), and `subtitle` for `aria-describedby`. `ActionModal` puts its answers there; "Formato" moves its two downloads there.

### D4: A compact stage table

`FLOW_TABLE_COMPACT_SX` is `FLOW_TABLE_SX` with 8 × 14 px cells and 13.5 px text. Its selectors apply to any table under the element, so `BasePolygonModal` wraps the reusable `Table` with it instead of passing header and body styles.

## Risks / Trade-offs

- [A button somewhere relied on uppercase or the shadow] → Only the text's case changes in the DOM's rendering; the tests query by text and pass. Screens checked: upload, validation, layers, results, report, and every modal in this change.
- [Two looks for outlined hover] → The theme's outlined hover is `blue50`; the drawing modal's hand-styled one is `blue25`. Left as is; it goes when those `sx` are removed.

## Migration Plan

None: a web-only change, deployed with the next merge into `dev`.
