## Context

The admin has four signed-in screens: layers, the layer editor, categories and usage. They share `AdminPageContainer`, which does three things:
- it sends a visitor without a session to the login;
- it draws an MUI head (a "Layers admin" overline, an `h3` title with " · {country}", a subtitle);
- it puts "Log out" next to the page's actions.

The admin sections and the country are in the header, through `HeaderNavigation` and `adminSections.ts`. Below 900 px they move into the header's menu (`MainNavigation`).

The categories are a three-column grid of `CategoryCard`. A category is created or edited in `CategoryPanel`, a 520 px `Drawer` that holds `CategoryForm` and `CategoryPreview` one under the other. The layers list is a small MUI table, and the layer editor and the usage page use `Paper` sections.

The flow's v2 pieces already exist in `components/page/flow/`:
- `FLOW_COLORS`, `STAGE_CARD`, `HEADING_FONT` and `stagePageBackground`;
- `FlowPageHead`, whose eyebrow is the flow's `StageEyebrow`;
- `FlowSection`, a card with an icon tile, a heading and an action;
- `FLOW_TABLE_FRAME` and `FLOW_TABLE_SX`, the mockup's table.

The admin has no CI on `feat/layer-manager` (D20): the checks run locally and go in the PR body.

## Goals / Non-Goals

**Goals:**
- The admin looks like the v2 mockup: the sidebar, the stage pages' heads, cards and tables.
- The session check and the navigation live in one place for every signed-in page.
- Creating and editing a category is a page, with its preview beside the form.
- No behavior changes beyond what the specs say: the same rules and locks, and the same API calls except a new category's id (D11).

**Non-Goals:**
- The wording of the results ("observaciones"). The product owner keeps it for now.
- The layers' scope (GLOBAL / NACIONAL) column of the mockup, a separate follow-up of #116.
- The layers table on the categories page, which the mockup shows and the product owner doesn't want.
- A warning about unsaved changes when leaving an editor. The panel had none either.
- The login page's look, beyond the new background.
- Any data change, and any API or contract change beyond D11.

## Decisions

### D1. A `(signed-in)` route group holds the sidebar and the session check

The routes `layers/`, `categories/` and `usage/` move under `app/[locale]/admin/(signed-in)/`. Their `layout.tsx` renders a client `AdminShell`, which does three things:
- it sends a visitor without a session to the login (moved from `AdminPageContainer`);
- it draws the leaves background;
- it draws the sidebar beside the page.

`admin/page.tsx` (the login) stays outside the group, so it has no sidebar. The URLs don't change, because route groups don't add a segment. `admin/layout.tsx` keeps loading the `common` and `admin` translations for both.

*Alternative:* draw the sidebar in `AdminPageContainer`. It would mount again on every navigation, and every page would keep its own session check. Rejected.

### D2. The sidebar's content and placement

The sidebar is about 264 px wide. It is sticky under the app header (64 px) and as tall as the viewport under it. It holds, from top to bottom:
- a mint card "Sesión de administración" with the country's name, from `getCountryName`;
- a `<nav>` with "Capas", "Categorías" and "Uso". Each item has an icon (`LayersOutlined`, `GridViewOutlined`, `BarChartOutlined`) and is a Next `Link` with `aria-current="page"` on the current one, marked as in the mockup (`blue50` background, `blue` text);
- "Cerrar sesión" (`Logout`), pushed to the bottom with `marginTop: auto`.

Below `md` (900 px) the sidebar is not rendered, and the content takes the full width.

`ADMIN_SECTIONS` gains each section's icon. The sidebar and the header's menu both read that list, so they can't drift apart.

### D3. A shared `useAdminLogout`

A hook returns a callback. The callback clears the session (`logout()` of `AdminSessionContext`) and replaces the route with the localized `/admin`. The sidebar and the header's menu both use it. `AdminPageContainer` loses its logout button.

### D4. The header on the admin pages

`HeaderNavigation` returns nothing on an admin path: no sections, no country, no `CountryMenu`. `MainNavigation` already hides "Home" and "Analysis" there. Below 900 px its menu keeps the country and the sections before "Methodology", as today, and adds "Log out" after it, only with a session.

### D5. One page head for the flow and the admin

`StageEyebrow` splits into two components:
- a presentational `PageEyebrow` (the green, spaced uppercase text);
- the flow's wrapper, which reads the current stage.

`FlowPageHead` gets an optional `eyebrow` node, and its default stays `<StageEyebrow />`, so the flow pages don't change.

`AdminPageContainer` becomes the admin's head and body. It renders `FlowPageHead` with:
- the eyebrow "Administración · {país}", or "Administración" when `countryInTitle` is false (usage);
- the title, the subtitle and the actions.

It takes an optional `back` link, shown above the eyebrow by the editors. The page's content goes under the head, as `FlowPage` stacks it. The " · {country}" suffix of the title is dropped, because the eyebrow carries it.

### D6. Category cards in a list

`CategoryCard` takes `STAGE_CARD` and a two-column body from `md`: `minmax(0, 1fr)` beside a result box of `minmax(280px, 380px)`.
- **Left column:** the icon tile on the category's tint, the name (`HEADING_FONT`), "EN · {name}", the description, and one detail line with the threshold and the polarity in words.
- **Right column:** the mockup's grey box with "Sin observaciones" and "Con observaciones" and their `ResultChip`s.
- **Footer, under a hairline:**
  - the layers ("3 capas · 3 publicadas: GFW, TMF, IDEAM");
  - the switch with its label;
  - "Editar" as a text button;
  - the lock's explanation under them when there is one.

Below `md` the result box goes under the description. A disabled category keeps today's muted background and "Deshabilitada" chip. There is no "···" menu: its only actions would be the ones the footer already shows.

The temporal chip ("Compara dos años") stays in the detail line, as today.

### D7. The category editor becomes a page

`CategoryForm` leaves `CategoryPanel.tsx`, and the `Drawer` wrapper is deleted. A new `AdminCategoryEditorPageContent` serves both routes:
- `(signed-in)/categories/new/page.tsx`;
- `(signed-in)/categories/[id]/page.tsx`, which calls `notFound()` when the id fails `^[a-z][a-z0-9_]{0,49}$`, as the layer route does with `\d+`.

The page loads three things:
- the categories, with `listAdminCategories`;
- the layers, with `listAdminLayers`, for the locks and the names;
- the global threshold, with `getDeforestationThreshold`.

There is no single-category GET, so editing finds the category in the list. When the category isn't in the list, the page shows an alert and the back link. When the file is unreadable, it shows the file's errors and no form, because the categories page wouldn't have offered the edit.

Inside the `FormProvider` the layout is a grid from `md`: the form's fields on the left, and `CategoryPreview` in a sticky aside on the right (`top` under the header). The sections are cards in the `FlowSection` style:
- name and description;
- icon and color;
- polarity;
- threshold and years;
- result texts.

The footer has "Cancelar" (back) and "Guardar". Once saved, the page shows today's snackbar and goes back to `/admin/categories`. That page loads its data on mount, so it shows the saved category without extra state.

`AdminCategoriesPageContent` loses the `editing` state and the panel: "Nueva categoría" and "Editar" navigate.

*Alternative:* keep the panel full screen (a full-width `Drawer`). It doesn't give a URL to share or reload, and the back button wouldn't close it. Rejected.

### D8. The layers table

The table uses `FLOW_TABLE_FRAME` and `FLOW_TABLE_SX`, straight under the page head. It has no extra card header, because the page head already says "Capas" and holds "Nueva capa".

The columns are:
1. ID;
2. **Capa**: the name in bold with the alias under it, muted;
3. Categoría, the existing `CategoryChip`;
4. **Período** (new);
5. Raster: the filename, or an amber "Sin raster" pill;
6. Versión;
7. Publicada: the switch;
8. "Editar", a text button.

The period comes from a pure `layerPeriod(layer, categories)`, tested on its own:

| The layer… | Period |
|---|---|
| has `baseline` and `compared_against` | `{baseline} → {compared_against}` |
| has no years, and its category resolves and is not temporal | "Vigente" / "Current" |
| anything else | "—" |

The blocked layer's notice stays as the row under it, as an amber band (`warnBackground`, `warn`) instead of an MUI `Alert`.

### D9. The usage page and the layer editor

- **Usage page.** Its local `Card` becomes a `STAGE_CARD` with the heading font. Its tiles take `STAGE_CARD` too. The range `ToggleButtonGroup` gets the flow's look: rounded, with the `blue50` / `blue` selected state. `UsageCharts` and the figures don't change.
- **Layer editor.** `LayerForm`'s `Section` keeps its signature plus an `icon`, and renders the `FlowSection` look. It keeps its `id` and `scrollMarginTop`, so the raster anchor still works. The icons are:
  - the layer (`LayersOutlined`);
  - the texts (`TranslateOutlined`);
  - the raster (`CloudUploadOutlined`).

  `RasterUploadSection` keeps its steps. The "Volver" button becomes the head's back link.

### D10. Texts

- **`admin.json`:**
  - `eyebrow` ("Administración · {{country}}" / "Admin · {{country}}") and `eyebrowAll` ("Administración" / "Admin");
  - `layers.columns.layer` ("Capa" / "Layer"), `layers.columns.period` ("Período" / "Period") and `layers.columns.actions` (the "Editar" column's header, read only by screen readers);
  - `layers.period.current` ("Vigente" / "Current");
  - `categories.form.sections.identity` and `categories.form.sections.rule`, the editor's new card headings;
  - `categories.form.idGenerated`, which says the API makes the id (D11);
  - `categories.editor.back` and `categories.editor.notFound`. The titles and the unreadable text reuse the existing `categories.form.*` and `categories.unreadable`.
- **Removed:** `title` ("Administración de capas"), `logout`, `layers.columns.name` and `layers.columns.alias`, `categories.form.close`, and the id field's `categories.form.id`, `idHelp`, `errors.id` and `errors.idTaken`.
- **`common.json`:** `header.admin.session` ("Sesión de administración" / "Admin session") and `header.admin.logout` ("Cerrar sesión" / "Log out"), beside the sections' labels, because the header's menu reads them too.
- **Interpolated names and ids** use `AS_TEXT`, as elsewhere.

### D11. The API makes a new category's id

The review found that a category with the id `new`, which the old pattern allowed, could never be edited: Next serves the static `/admin/categories/new` before `[id]`. Moving the create page to a path no id can take would hide the problem in the URL. Instead, as the API numbers layers, it now makes the id:
- `CategoryCreate` has no `id`, and an `id` in the body is a 422 (`extra="forbid"`);
- the id is the slug of the Spanish name, the rule the editor used to suggest: accents dropped, lowercase, runs of other characters as `_`, starting with a letter, at most 50 characters; `category` when nothing is left;
- an id the country uses or used (a rejected entry), `deforestation` or `new` gets `_2`, `_3`..., the base cut so the whole stays within 50;
- a layer that already points at the generated id is adopted with the same 400 checks as before.

The slug keeps ids readable in `categories.json` and in results, unlike a number. A hand-edited `categories.json` could still hold `new`; the admin can't edit that category, and the file is the place to fix it.

Alternatives considered:
- **A create path no id can match (`new-category`).** It works, but leaves an admin-typed id that is easy to get wrong and that the UI has to check against the list.
- **Reserving `new` in the id's pattern.** It would reject a stored `new` in the public app too, hiding its layers.

### D12. More icons and colors for a category

Eight icons and six colors fell short once countries added their own categories. Following the picker of another product the team built (a tile grid of icons, a row of swatches), with the layout Monbo already has:
- the catalogue grows from 8 to 26 icons: `park`, `leaf`, `wildlife`, `legal`, `community`, `map`, `global`, `coast`, `flood`, `crop`, `coffee`, `pasture`, `volcano`, `landslide`, `mining`, `infrastructure`, `settlement` and `industry` join the existing ones. Each maps to a Material outlined icon in `LayerCategoryIcon`, and its name is in `admin.json` (es, en). The `CategoryIcon` literal lists them in the picker's order;
- the editor shows them under "Ícono" as a grid of separate 44 px tiles, not grouped by theme, each with its name as a tooltip;
- the swatches go from 6 to 12. The chips and the icon tiles draw the color as text on its 12% tint (`categoryTints`), so each swatch has at least 4.5:1 on its tint. Two of the old ones, `#2f8f5e` (3.5:1) and `#a8741a` (3.5:1), fell short and are replaced by darker ones. Under the swatches, "Otro color" still takes any hex, with a sample of the color inside the field.

Adding a value to the literal is backward compatible: a stored category keeps its icon and color, and an older web falls back to the layers icon for a name it doesn't know.

Alternatives considered:
- **Icons grouped by theme (Nature, Water, Land use...).** It reads better with many icons, but the product owner chose the plain grid.
- **A popover from the icon tile, as in the other product.** It hides the choices behind a click, where the editor already has the room to show them.

## Risks / Trade-offs

- **[Moving the routes into a group breaks imports or tests that name the page files]** → The pages are 5-line wrappers and the tests import the `*PageContent` components. A build catches any leftover path.
- **[The sidebar's sticky height depends on the header's 64 px]** → The sidebar uses one named constant beside `PREVIEW_PANEL_HEIGHT`'s, and is checked at 900 px and 1440 px.
- **[Nine columns' worth of data in about 900 px]** → Name and alias share a cell, and long filenames wrap (`overflowWrap: anywhere`). The frame scrolls inside if a column still overflows, never the page.
- **[The editor page reloads the whole category list to edit one]** → The list is small (a handful per country) and is already what the panel received. No API change is worth it.
- **[Leaving the category editor loses typed values without a warning]** → This is accepted for now, as with the panel. "Cancelar" is explicit.
- **[The minimal header hides the country selector on the admin]** → The session's country is fixed, so a selector there would only mislead. The sidebar names the country.

## Migration Plan

No stored data changes: existing ids, icons and colors stay as they are, and only new categories get an id made by the API. It ships in one PR into `feat/layer-manager`.

- **Old URLs:** the routes keep theirs, and the panel had no URL, so no redirect is needed.
- **Rollback:** revert the PR.
- **Archive:** after `add-layer-categories`, `admin-layer-categories` and `admin-categories-ui`, whose versions of "Per-country category file", "Create a category", "Admin UI" and "Category administration UI" this change modifies.

## Open Questions

None. The decisions above were agreed in the exploration with the product owner:
- the minimal header;
- the menu below 900 px;
- the threshold and polarity on the card, without "···";
- name and alias stacked;
- "Administración" alone on usage;
- the wording unchanged;
- one change and one PR.
