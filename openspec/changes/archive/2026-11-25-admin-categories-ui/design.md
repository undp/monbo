## Context

- GC-2 (`admin-layer-categories`, merged in `feat/layer-manager`) is the contract this
  UI builds on, already in `apps/web/src/api/schema.d.ts`:
  - `GET /admin/categories` → `AdminCategories { categories, readable, errors }`;
    each `AdminCategory` is camelCase, with its own `thresholdPercentage` (`null` =
    the global one), `enabled`, `layerCount` and `publishedLayerCount`;
  - `POST /admin/categories` (`CategoryCreate`, 201; 409 when the id is taken or the
    file is unreadable), `PUT /admin/categories/{id}` (`CategoryInput`) and
    `PATCH /admin/categories/{id}` (`EnabledInput`);
  - `AdminLayer` (snake_case, like the index) carries `category_id`,
    `category_issue` (`unknown_category` | `invalid_category` |
    `unreadable_categories`), `category_enabled` and `layer_issue`
    (`years_mismatch` | `missing_raster`), computed for every layer, enabled or not;
  - `LayerInput.category_id` is required; `baseline` and `compared_against` are
    `int | null`, both for a temporal category and neither otherwise (400);
  - the rules of GC-2's design §4 answer 400 with an English message that names the
    layers. The UI must explain them up front (orchestration risk "polaridad
    invertida", and the user's request in GC-1).
- The admin web today (`components/page/admin/`): a layers list, a layer editor
  (`LayerForm` + `layerFormState.ts`, react-hook-form) with a raster section, and the
  usage page. GC-2 left a bridge: the form keeps `category_id` (`deforestation` for a
  new layer) and always sends years, so it can't save a layer of a non-temporal
  category.
- GC-6 and GC-8 already built the shared category pieces: `LayerCategoryIcon`
  (`components/reusable/`), `categoryTints` (`utils/categoryColors.ts`),
  `localizedText`, `CategoryChip` (`components/page/documentation/`), and the single
  classifier `classifyResult` / `findingRatio` (`utils/layerResults.ts`, GC-4). D23
  fixes the result colors: "no findings" in the theme's success green, "with
  findings" in red, the category color only on headers, cards, legend and icons.
- Reference design: "Admin · Nueva categoría" in mockup v2 (cards with icon, names,
  description, result chips, layers and "Edit"; a right-hand drawer with names,
  description, icon and color, "¿Qué marcan las capas de esta categoría?" as two
  explained options, result texts and a preview). The mockup's admin sidebar is not
  in the app: the admin header navigation is.

## Goals / Non-Goals

**Goals:**

- A country's admin creates, edits, enables and disables its categories, and picks
  each layer's category, from the UI.
- The polarity is never chosen by default and its effect is visible before saving.
- Every API rule that can block an action is visible, with its reason and the fix,
  before the admin tries it; the 400 stays a fallback.
- The admin sees why an enabled layer is not public, and how to fix it.
- Existing layers of non-temporal categories can be edited.

**Non-Goals:**

- Any API or contract change. Fields the API doesn't have (a layer's scope
  "Global/Nacional", layer names on `AdminCategory`) stay out (orchestration
  follow-up).
- Deleting categories (the API has no route) or reordering them.
- Repairing a rejected `categories.json` entry from the UI (`PUT` on a rejected id):
  the listing doesn't return rejected entries' fields, so the UI shows the errors and
  the fix stays an operations task, as `docs/maps.md` describes.
- The mockup's admin sidebar, and the generic wording of the rest of the app (GC-11).

## Decisions

### 1. A categories page, a drawer, and a third navigation item

New route `/[locale]/admin/categories` (`AdminCategoriesPageContent`), inside
`AdminPageContainer` like the layers page (overline "Layers admin", title with the
country). The admin header gets a third item, in this order: **Layers, Categories,
Usage**. Login still lands on the layers list.

- Cards in a responsive grid (one column at 390 px, two or three on desktop), in the
  API's order (the order of `GET /categories`). Each card: the icon on the category
  color (`categoryTints`), name in the UI language with the other language below,
  description, a line that says what its layers mark (polarity in plain words),
  the threshold ("Global threshold (X %)" or "X %"), the two result chips, the
  layers of the category (aliases, loaded with `GET /admin/layers`) with how many
  are published, an "Edit" button and an "Enabled" switch. A disabled category is
  shown muted with a "Disabled" chip.
- The page loads `GET /admin/categories` and `GET /admin/layers` in parallel. The
  layers give names to the counts, so the locks (decision 4) can say "hide IDEAM
  2020-2023 first" instead of "hide 1 layer". The counts themselves come from the
  category (the API's own numbers), so a layer list and the counts can't disagree
  about what blocks an action.
- `readable: false` → an error alert with `errors`, "New category", "Edit" and the
  switches disabled (the API answers 409 anyway). Rejected entries with a readable
  file → a warning alert with `errors`; the rest of the page works.
- **Phones.** At 390 px the admin header couldn't fit its sections and the country
  even with two items, so below 900 px they move into the header's existing menu
  (the public pages' hamburger), under the country's name, and the page title's
  actions wrap under the title. Found while checking the page at 390 px.
- *Alternative:* categories on the layers page, as in the mockup. Rejected: the
  layers page already has a wide table and the raster flow starts from it; a
  separate page keeps both readable at 390 px and matches the sub-issue ("página de
  categorías del país").

### 2. The category panel

An MUI `Drawer` anchored right, 520 px wide on desktop and full width on small
screens, with a sticky footer ("Cancel", "Create category" / "Save"). Its own
react-hook-form instance and a pure `categoryFormState.ts` (values, conversions,
validators), like `layerFormState.ts`.

Fields, in the mockup's order:

1. **Name** ES and EN (required, ≤ 100) and **short description** ES and EN
   (optional, ≤ 1000), with "shown in the analysis, the report and the
   methodology".
2. **Id** (create only): suggested from the Spanish name while the admin hasn't
   edited it (`suggestCategoryId`: lowercase, accents removed, non-alphanumerics to
   `_`, collapsed, a leading letter, ≤ 50, so it matches
   `^[a-z][a-z0-9_]{0,49}$`). Helper: "Permanent: it identifies the category in the
   layers and can't be changed or reused." Validated with the same pattern, and
   against the ids already listed (an id in the list is taken; `deforestation`
   always is). A 409 from the API (an id held by a rejected entry the list doesn't
   show) is shown on the field. When editing, the id is shown as text.
3. **Icon** (the eight icons of D15, as toggle buttons with `LayerCategoryIcon`) and
   **color** (preset swatches: D15's `#c62828` and the mockup's six, plus a
   `#rrggbb` text field for any other). A new category starts with `layers` and the
   first swatch; both are cosmetic.
4. **What its layers mark** (polarity): two explained radio cards, **no default**:
   - `avoid` — "What must be avoided. E.g. forest loss or protected areas. A polygon
     that overlaps the layer has a finding.";
   - `required` — "What is allowed. E.g. the agricultural frontier. A polygon that
     falls *outside* the layer has a finding."
   The value starts as `null` and the validator refuses to save without one
   (`admin:categories:form:errors:polarity`).
5. **Layers compare two years** (`temporal`, a switch, off by default), explaining
   that temporal layers need a baseline and a comparison year (forest loss) and the
   others don't (protected areas, frontier).
6. **Threshold**: "Use the global threshold (X %)" (`thresholdPercentage: null`,
   checked by default for a new category) or the category's own value, 0–100, with
   the rule in words: "A polygon has findings when its finding is above the
   threshold." X comes from `getDeforestationThreshold()` (`GET /config`), the
   fallback the API applies (D3).
7. **Result texts**: "No findings" and "With findings", each in ES and EN
   (required, ≤ 60).
8. **Preview** (decision 3).

On save: `POST` (then the card appears) or `PUT` (the card updates), a success
snackbar, the drawer closes. Errors: 422 → the API's details (as the layer form
does); 409 on create → the id field; any other 4xx → an alert inside the drawer
with a translated sentence plus the API's message, so nothing the API refuses is
silent.

*Alternative:* a dedicated `/admin/categories/new` page like the layer editor.
Rejected: the mockup uses a drawer, the form is short, and the cards stay visible
for reference.

### 3. The preview uses the shared classifier

`CategoryPreview` shows, in ES and EN, the category chip (`CategoryChip`, with the
typed name, icon and color) and two example results:

- a polygon with **no finding** → the "no findings" chip (success green, check
  icon, the `ok` text);
- a polygon with an example finding of `e` % → the "with findings" chip (red,
  "`e` % · flagged text").

Each example is built as a coverage `value` and classified with GC-4's
`classifyResult(value, { polarity, thresholdPercentage })`; the chip is chosen by
the class it returns, never by the example's intent. With `avoid` the examples read
"overlaps the layer 0 %" and "overlaps the layer `e` %" (`value = e/100`); with
`required` they read "falls outside the layer 0 %" and "falls outside the layer
`e` %" (`value = 1 − e/100`). So switching the polarity changes the captions and the
values while the chips stay put, which is the point: the admin sees which polygon
gets the observation. `e` is 18 (the mockup's), raised to `floor(threshold) + 5` when
the threshold is 18 or more; with a threshold of 100 nothing can be flagged, and the
preview says so instead of a red chip. Without a polarity, the preview asks to
choose one first.

*Alternative:* a static preview of the two labels. Rejected: it can't show the
polarity, and a preview that computes its own rule could disagree with the app.

### 4. Locks that explain the API's rules

A pure module (`categoryRules.ts`) turns a category (and its layers) into the
locks, each with a translation key and the names of the layers that cause it:

| Control | Locked when | Explanation |
|---|---|---|
| Category switch (both ways) | `publishedLayerCount > 0` | "It has published layers (A, B). Hide them to enable or disable the category." |
| Polarity (edit) | `publishedLayerCount > 0` | "It can't change while layers A, B are published: they would be read the other way round. Hide them first." |
| `temporal` (edit) | `layerCount > 0` | "It can't change while the category has layers (A, B): their years would stop matching." |
| Layer form, category select | the layer is enabled | "A published layer can't change category. Hide it first." |
| Everything | `readable: false` | the file errors |

Locked controls stay visible and disabled with the explanation as helper text (not
only a tooltip, which touch screens don't show). Threshold, texts, icon and color
are never locked; when the category has published layers the panel notes that
changing the threshold or the texts changes how existing results read.

### 5. The layer form picks the category, and years follow `temporal`

- `LayerFormValues.category_id` starts empty for a new layer (no default category)
  and is validated as required and as an id of a usable category.
- The select lists the enabled categories, each with its icon and name. The layer's
  current category is also listed when it is disabled (the API lets a `PUT` keep
  it) or broken (`category_issue`, shown as its raw id with the issue), so the form
  shows the truth; a broken one fails validation ("choose a valid category"),
  because the API refuses it.
- `baseline` and `compared_against` render only when the selected category is
  `temporal`. `toLayerInput(values, category)` sends them as numbers for a temporal
  category and `null` otherwise; the year validators only run while the fields are
  shown. The typed years stay in the form values, so switching categories back and
  forth doesn't lose them.
- The editor loads `GET /admin/categories` with the layer. If the categories can't
  be loaded or the file is unreadable, an alert explains it and saving stays
  possible only for what the API accepts (it will refuse an unresolvable category).

### 6. Why a layer isn't public

A pure helper `layerVisibility(layer)` returns one of:

| Case | Status | How to fix (shown) |
|---|---|---|
| enabled, `category_issue` null, `category_enabled`, `layer_issue` null | Public | — |
| `category_issue` (any) | Hidden: the category doesn't exist / is invalid / the categories file can't be read | Move the layer to another category (hide it first), or fix the category |
| `category_enabled` false, no issue | Hidden: its category is disabled | Enable the category, or move the layer |
| `layer_issue: years_mismatch` | Hidden: its years don't fit the category | Edit its years (or hide it and move it) |
| `layer_issue: missing_raster` | Hidden: no raster | Upload a raster |
| disabled | Hidden | (blocking issues above listed as "To publish it: …") |

Order of precedence: category issue, disabled category, years, raster (the order
the API checks). The layers list shows the category (`CategoryChip`, or a grey chip
with the raw id when it doesn't resolve) in a new column, and the status under the
"Published" switch for enabled layers that aren't public. The layer editor shows the
same status as an alert above the form. Publishing (list switch and raster section)
checks the helper first and shows the reason instead of calling the API when it
already knows the answer; a 400 or 409 the UI didn't foresee shows the API's
message after a translated sentence.

### 7. API client and shared pieces

- `api/adminCategories.ts`: `listAdminCategories`, `createAdminCategory`,
  `updateAdminCategory`, `setAdminCategoryEnabled`, on the existing `request()` of
  `adminLayers.ts`, types from `interfaces/AdminLayer.ts` (already re-exported by
  GC-2).
- `CategoryChip` moves from `components/page/documentation/` to
  `components/reusable/` (generic, now used by two screens); its two imports are
  updated.
- The result chips of the preview and the cards reuse the methodology's
  `ResultChip` (D23's result colors, `utils/styling.ts`), which also moves to
  `components/reusable/`.
- `DEFAULT_CATEGORY_ID` stays in `interfaces/AdminLayer.ts` only for the built-in
  category's "always taken" id check.

### 8. Texts

New keys under `admin:categories:*`, `admin:form:category*` and
`admin:layers:status:*`, and `common:header:admin:categories`, in `es` (neutral
Spanish with tú, D6) and `en`. The three admin texts GC-3 flagged ("deforestation"
in the login subtitle, the layers list subtitle and the publish notice) become
generic ("layers", "territorial analysis"). The rest of the generic wording is
GC-11's.

## Risks / Trade-offs

- [Counts and layer names come from two requests that can disagree for a moment] →
  The locks use the category's counts (the API's); names are only a hint, and the
  API re-checks every write under its lock.
- [Two admins edit the same country] → Last write wins (GC-2). After every write the
  page replaces the card with the API's response; a 400 caused by someone else's
  change shows the API's message.
- [The admin types a description or label longer than the API allows] → The form
  enforces the API's lengths (100, 1000, 60) with counters, so 422 only appears if
  they drift; the 422 details are still shown.
- [Preview example values are arbitrary] → They are captioned as examples and
  classified by the real function; a threshold of 100 is called out.
- [The mockup isn't revalidated (D10)] → Layout changes the client asks for are
  adjustments on top of this.

## Migration Plan

- Deploys with the integration PR (`feat/layer-manager` → `dev`). No data or API
  change: a country without `categories.json` shows only the built-in
  "Deforestation", and its existing layers keep working.
- Rollback: reverting the web restores GC-2's bridge form, which can't save layers of
  non-temporal categories (already the case before this change).

## Open Questions

For gate 1:

1. A separate categories page with a third "Categories" header item, instead of
   categories on the layers page as in the mockup (decision 1). Recommended.
2. `temporal` as an explicit switch, off by default, with an explanation; only the
   polarity has no default (decision 2). Recommended: the sub-issue only requires
   the polarity to be explicit, and `temporal` is harmless to get wrong while the
   category has no layers (it locks once it has one).
3. Repairing a rejected entry (`PUT` on an id the list doesn't return) stays out of
   the UI: the page shows the errors and operations fix the file (decision non-goal).
   Recommended, since the listing has no fields to prefill.
