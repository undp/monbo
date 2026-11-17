## 1. Shared pieces

- [x] 1.1 Add `api/adminCategories.ts` (`listAdminCategories`, `createAdminCategory`, `updateAdminCategory`, `setAdminCategoryEnabled`) on the `request()` of `adminLayers.ts`, typed with the re-exports of `interfaces/AdminLayer.ts`
- [x] 1.2 Move `CategoryChip` from `components/page/documentation/` to `components/reusable/` and update its imports
- [x] 1.3 Reuse the methodology's `ResultChip` (no findings green with a check, with findings red, D23) for the cards and the preview, moved to `components/reusable/`

## 2. Category form state and rules

- [x] 2.1 `components/page/admin/categoryFormState.ts`: form values (polarity starts `null`, threshold "global" by default), `toCategoryFormValues(category?)`, `toCategoryInput(values)` / `toCategoryCreate(values)`, `suggestCategoryId(name)` and validators (required texts, lengths 100/1000/60, color `#rrggbb`, threshold 0–100, id pattern and taken ids, polarity required)
- [x] 2.2 `components/page/admin/categoryRules.ts`: the locks of design §4 (category switch, polarity, `temporal`, unreadable file) with the names of the layers that cause them
- [x] 2.3 `components/page/admin/layerVisibility.ts`: the status of a layer (public, or hidden with its reason and fix) from `enabled`, `category_issue`, `category_enabled` and `layer_issue`, in the API's order
- [x] 2.4 Unit tests for the three modules: id suggestion (accents, spaces, leading digits, length), polarity required, input conversion (global threshold → `null`), each lock and each visibility case

## 3. Categories page and panel

- [x] 3.1 Route `app/[locale]/admin/categories/page.tsx` and `AdminCategoriesPageContent`: loads categories and layers, cards in a responsive grid, enable switch with its lock, "New category", alerts for `readable: false` and rejected entries
- [x] 3.2 `CategoryPanel` (right drawer, full width on small screens): the fields of design §2 in order, id suggested from the Spanish name until edited, locks with their explanations, save with `POST`/`PUT`, 409 on the id field, other errors as a translated alert with the API's reason
- [x] 3.3 `CategoryPreview`: the category chip and the two example results classified with `classifyResult`, captions by polarity, the threshold-100 case, a prompt when no polarity is chosen
- [x] 3.4 Add "Categories" to the admin header navigation (`HeaderNavigation.tsx`), between "Layers" and "Usage"
- [x] 3.5 Component tests: the panel doesn't save without a polarity; the preview changes with the polarity; a create sends the suggested id and `thresholdPercentage: null`; a category with published layers locks its switch and polarity with the layers' names
- [x] 3.6 Below 900 px, move the admin sections and the country into the header's menu (`MainNavigation`), and let the admin page title's actions wrap (`AdminPageContainer`), so the admin fits 390 px

## 4. Layer form and layers list

- [x] 4.1 `layerFormState.ts`: `category_id` starts empty for a new layer and is validated against the usable categories; `toLayerInput(values, category)` sends years only for a temporal category and `null` otherwise; year validators only when shown
- [x] 4.2 `LayerForm`: category select (enabled categories plus the current one when disabled or broken), locked for a published layer with its explanation; years rendered only for a temporal category
- [x] 4.3 `AdminLayerEditorPageContent`: load the categories with the layer, the visibility alert above the form, an alert when the categories can't be loaded or read
- [x] 4.4 `AdminLayersPageContent`: "Category" column (`CategoryChip`, or the raw id in grey when it doesn't resolve) and the reason an enabled layer isn't public; publishing checks `layerVisibility` first and shows the API's reason for an unforeseen 400/409
- [x] 4.5 `RasterUploadSection`: publishing shows the visibility reason or the API's reason instead of a generic error
- [x] 4.6 Tests: `layerFormState` (years `null` for a non-temporal category, numbers for a temporal one, category required, broken category refused); the form hides the years for a non-temporal category; the list shows the reason for a layer hidden by a disabled category

## 5. Texts and docs

- [x] 5.1 Keys in `locales/es/admin.json` and `locales/en/admin.json` (`categories`, `form.category*`, `layers.columns.category`, `layers.status`) and `common:header:admin:categories`; neutral Spanish with tú
- [x] 5.2 Make generic the admin texts that still say "deforestation": login subtitle, layers list subtitle, publish notice
- [x] 5.3 `docs/maps.md`: "Managing categories in the admin" points to the categories page and how the UI explains the rules

## 6. Verification

- [x] 6.1 Run the app with a test per-country layout (scratchpad, no passkeys in the repo) and a real admin session; check the categories page, the panel, the layer form and the list on desktop and at 390 px; create "Frontera agrícola" (`required`), assign a layer, publish it, and see it in `GET /maps` and `GET /categories`
- [x] 6.2 Run the web checks of `CLAUDE.md` locally: schema check, `pnpm exec tsc --noEmit`, `pnpm run lint`, `pnpm test`, `pnpm run build`
- [x] 6.3 `openspec validate admin-categories-ui --strict`
