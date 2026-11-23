## Why

The analysis flow now follows the v2 mockup, but the admin still has the old look: MUI headings and `Paper` cards, its sections as buttons in the header, "Log out" next to every page's actions, the categories as a three-column grid of cards, and a 520 px side panel to create or edit a category, where the preview sits below the form. The v2 mockup gives the admin a left sidebar with the session's country and its sections, the stage pages' heads, cards and tables, and category cards with the layer results side by side. The product owner asked for these changes:
- a left sidebar in place of the header's sections, with "Log out" in it;
- the category cards of the mockup, one under the other, with the enable switch and without the "···" menu;
- no layers table on the categories page, unlike the mockup;
- the layers table of the mockup, keeping the current columns and adding the mockup's period;
- the new styles on the usage page and the layer editor;
- creating and editing a category on a full page, like a layer.

This change is part of the layer-manager project (undp/monbo#116, GC-10).

## What Changes

- **Admin sidebar.** Every signed-in admin page shows a left sidebar:
  - a "Sesión de administración" card with the administered country;
  - the sections "Capas", "Categorías" and "Uso", with icons, the current one marked;
  - "Cerrar sesión", pinned at the bottom.

  Below 900 px the sidebar is hidden: the sections and "Cerrar sesión" are in the header's menu, as the sections are today. The login page has no sidebar.
- **A minimal admin header.** On the admin pages the header shows only "Metodología" and the language selector. The sections and the country move out of it, to the sidebar.
- **The stage pages' head on every admin page.**
  - An eyebrow: "ADMINISTRACIÓN · {país}". On the usage page, which covers every country, just "ADMINISTRACIÓN".
  - The title in the heading font, the subtitle, and the page's action at the right.
  - The pages' background is that of the stage pages.
- **Categories page.**
  - The cards go one under the other. Each card shows two columns: on the left the icon, the name in both languages, the description, the threshold and the polarity; on the right the "Sin observaciones" and "Con observaciones" result texts.
  - Its footer has the layers, the enable switch and "Editar". There is no "···" menu.
  - The page shows no layers table.
- **Category editor on a full page.** "Nueva categoría" opens `/admin/categories/new`, and "Editar" opens `/admin/categories/{id}`:
  - the form on the left, the preview on the right, following the scroll;
  - "Volver" goes back to the categories.

  The side panel is removed. The form, its rules and its preview don't change.
- **Layers table in the mockup's style.**
  - Its columns: ID, the name with the alias under it, Categoría, **Período** (new), Raster, Versión, Publicada (the switch) and "Editar".
  - The period is "2020 → 2023" for a layer with both years, "Vigente" for a layer without years in a category that is not temporal, and "—" otherwise.
  - "Sin raster" is an amber pill. The notice of a blocked layer stays under its row.
- **Usage page.** Its cards and its range selector take the new style. The charts and figures don't change.
- **Layer editor.** Its sections become the stage pages' cards, with an icon and a heading. The raster steps keep their content.
- The wording of the results ("observaciones") doesn't change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `layer-administration`:
  - "Admin UI": the sidebar holds the country, the sections and "Log out"; the header only "Methodology" and the language; the layers list shows the period; the eyebrow names the country.
  - "Category administration UI": the cards go in a list; creating and editing happen on a full page, not in a panel.
- `usage-dashboard`: "Admin usage page" has the "Admin" eyebrow, without the country.

## Impact

- **Web only** (`apps/web/src`), with no API or contract change:
  - `app/[locale]/admin/`: a `(signed-in)` route group with the sidebar's layout; the new `categories/new` and `categories/[id]` routes. The URLs don't change.
  - `components/page/admin/`: `AdminPageContainer` (the new head; the session check moves to the layout), a new sidebar, `AdminCategoriesPageContent`, `CategoryCard`, `CategoryPanel` (becomes a page), `AdminLayersPageContent`, `AdminLayerEditorPageContent`, `LayerForm`, `AdminUsagePageContent` and `UsageCharts`.
  - `components/reusable/Header/`: `HeaderNavigation` drops the admin sections and country; `MainNavigation` keeps them in the menu below 900 px and adds "Log out".
  - `components/page/flow/`: the head, card and table styles are reused, not changed for the flow.
- **i18n:** `admin.json` and `common.json` in `es` and `en`: the sidebar, the eyebrow, the period and the category page's texts.
- **Docs:** `docs/maps.md` (the category panel), `docs/onboarding.md` and `docs/architecture.md` (where they say the admin header holds the sections and the country).
- **Archive order:** after `admin-categories-ui`, which adds "Category administration UI" and the latest "Admin UI".
