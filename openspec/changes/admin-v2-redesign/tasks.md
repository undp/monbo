## 1. Shell and navigation

- [x] 1.1 Move `layers/`, `categories/` and `usage/` under `app/[locale]/admin/(signed-in)/`, with a `layout.tsx` that renders `AdminShell`; the login (`admin/page.tsx`) stays outside; check the URLs don't change
- [x] 1.2 `AdminShell`: the session check moved from `AdminPageContainer` (spinner until ready, replace to `/admin` without a session), the leaves background, and the sidebar beside the content from `md`
- [x] 1.3 `ADMIN_SECTIONS` gains each section's icon; `AdminSidebar`: the "Sesión de administración" card with the country, the three items as `Link`s with `aria-current`, and "Cerrar sesión" at the bottom; sticky under the header, hidden below `md`
- [x] 1.4 `useAdminLogout()` (clears the session, replaces to the localized `/admin`), used by the sidebar and the header's menu
- [x] 1.5 `HeaderNavigation` renders nothing on admin paths; `MainNavigation`'s menu keeps the country and sections before "Metodología" and adds "Cerrar sesión" after it, only with a session
- [x] 1.6 Tests: the sidebar marks the current section and logs out; the header on an admin page has no sections, country or country selector; the phone menu's order with "Cerrar sesión"; the login has no sidebar and no admin items; no session sends to the login

## 2. Page head

- [x] 2.1 Split `StageEyebrow` into a presentational `PageEyebrow` and the flow wrapper; `FlowPageHead` takes an optional `eyebrow` (default `<StageEyebrow />`), the flow pages unchanged
- [x] 2.2 `AdminPageContainer` renders `FlowPageHead` with "Administración · {país}" (or "Administración" when `countryInTitle` is false), title, subtitle and actions, an optional `back` link above it, and its content stacked under it; drop the logout button, the session check and the " · {country}" title suffix
- [x] 2.3 Tests: the eyebrow with the country on layers and categories, "Administración" alone on usage; the flow heads still show "Etapa N de 3"

## 3. Categories page

- [x] 3.1 `AdminCategoriesPageContent`: cards one under the other; "Nueva categoría" and "Editar" navigate to `/admin/categories/new` and `/admin/categories/{id}`; remove the `editing` state and the panel
- [x] 3.2 `CategoryCard` on `STAGE_CARD`: two columns from `md` (identity, description, threshold, polarity and the temporal chip on the left; the result texts' box on the right), stacked below; footer with the layers, the switch and "Editar", and the lock's explanation; no "···"; the disabled look kept
- [x] 3.3 Tests: the cards in a list with their threshold, polarity and result texts; no layers table; "Editar" and "Nueva categoría" navigate; the switch and its lock as before

## 4. Category editor page

- [x] 4.1 Routes `(signed-in)/categories/new/page.tsx` and `(signed-in)/categories/[id]/page.tsx` (`notFound()` when the id fails `^[a-z][a-z0-9_]{0,49}$`)
- [x] 4.2 Move `CategoryForm` out of `CategoryPanel.tsx`, delete the `Drawer` wrapper; `AdminCategoryEditorPageContent` loads the categories, the layers and the global threshold, computes the locks, and shows the not-found alert or the unreadable file's errors instead of the form
- [x] 4.3 Layout: the form's groups as `FlowSection`-style cards on the left, `CategoryPreview` in a sticky aside on the right from `md`, under the form below; footer with "Cancelar" and "Guardar"; once saved, the snackbar and back to `/admin/categories`
- [x] 4.4 Move `CategoryPanel.test.tsx` to the editor page: create (`POST`, back to the list), edit (id not editable, `PATCH`), no polarity, preview follows the polarity, published-layer and temporal locks, unknown id, unreadable file

## 5. Layers

- [x] 5.1 `layerPeriod(layer, categories)` in `components/page/admin/`: both years → "{baseline} → {compared_against}", no years in a non-temporal resolved category → "Vigente", "—" otherwise; unit tests for each case
- [x] 5.2 `AdminLayersPageContent`: `FLOW_TABLE_FRAME` + `FLOW_TABLE_SX`, columns ID, Capa (name bold, alias under it), Categoría, Período, Raster (filename or amber "Sin raster" pill), Versión, Publicada (switch), "Editar"; the blocked notice as an amber band row; long texts wrap
- [x] 5.3 Layer editor: `Section` in `LayerForm` takes an `icon` and the `FlowSection` look, keeping `id` and `scrollMarginTop`; the head's back link replaces the "Volver" button; `RasterUploadSection`'s steps unchanged
- [x] 5.4 Tests: the period column; name and alias in one cell; the blocked notice; the editor's sections and back link (the 390 px check is by hand, in 10.3)

## 6. Usage page

- [x] 6.1 `AdminUsagePageContent`: the local `Card` and the tiles on `STAGE_CARD` with the heading font; the range selector in the flow's style; charts and figures unchanged
- [x] 6.2 Tests: the existing usage tests pass with the new head ("Administración", no country)

## 7. Texts and docs

- [x] 7.1 Texts as D10 lists them: in `admin.json` (es, en) `eyebrow`, `eyebrowAll`, `layers.columns.layer`, `.period` and `.actions`, `layers.period.current`, `categories.form.sections.identity` and `.rule`, `categories.form.idGenerated`, `categories.editor.back` and `.notFound`; in `common.json` `header.admin.session` and `header.admin.logout`; remove `title`, `logout`, `layers.columns.name` and `.alias`, `categories.form.close` and the id field's keys; `AS_TEXT` for interpolated names and ids
- [x] 7.2 `docs/maps.md` (the category editor is a page, and the API makes the id), `docs/onboarding.md` (the sidebar holds the usage page), `docs/architecture.md` (the sidebar shows the country, the header doesn't)

## 8. The API makes a new category's id (D11, from the PR's review)

- [x] 8.1 `CategoryCreate` without `id`; `create_category` makes it from the Spanish name (`new_category_id`), with `_2`, `_3`... for a used, rejected, `deforestation` or `new` id; regenerate `openapi.json` and `schema.d.ts`
- [x] 8.2 API tests: the slug (accents, symbols, a leading digit, no letter, 50 characters), used and reserved ids, an `id` in the body is 422, and the existing create tests by name
- [x] 8.3 Editor: no id field, the note that the API makes it, no `id` in the `POST`; drop the suggestion, the taken-id check and its texts
- [x] 8.4 Tests of the `[id]` route: a malformed id gives the not-found page, a well-formed one opens the editor
- [x] 8.5 Review's nits: the usage range selector wraps below 600 px; `AdminShell` doesn't redirect while the session is being read (`ready: false`)

## 9. More icons and colors (D12)

- [x] 9.1 `CategoryIcon` with 26 names in the picker's order; regenerate `openapi.json` and `schema.d.ts`
- [x] 9.2 `LayerCategoryIcon` maps the 18 new names; their es/en names in `admin.json`
- [x] 9.3 Editor: under "Ícono", the icons as a grid of 44 px tiles with their name as a tooltip; under "Color", 12 swatches with at least 4.5:1 on their tint, and below them "Otro color" with a sample of the typed color inside the field
- [x] 9.4 Tests: the API accepts and serves a new icon, and the catalogue has 26 names once each; the editor offers 26 named icons and 12 colors and saves the chosen ones
- [x] 9.5 `docs/maps.md` lists the new icons
- [x] 9.6 Check the icon grid and the swatches by hand at 1440 px and 390 px, in `es` and `en`

## 10. Verification

- [x] 10.1 `pnpm exec tsc --noEmit`, `pnpm run lint`, `pnpm test` and `pnpm run build` in `apps/web`; `uv run pytest`, `ruff`, `black --check`, `mypy app` and `python -m app.openapi --check` in `apps/api`
- [x] 10.2 `openspec validate admin-v2-redesign --strict`
- [x] 10.3 Run the admin locally (login, layers, layer editor with raster steps, categories, new and edit category, usage) at 1440 px, 900 px and 390 px, in `es` and `en`, and compare with the mockup
