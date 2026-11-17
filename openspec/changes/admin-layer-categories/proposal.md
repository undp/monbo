## Why

`add-layer-categories` (GC-1) gave every country a `categories.json` and every layer a
`category_id`, but nothing writes them: a country's admin can't create "Protected areas" or
"Agricultural frontier", and every layer created through the admin silently falls into
`deforestation`. A layer whose category is broken is hidden from the public app with a
`category_issue` the admin can't see yet. This change is the admin API for categories and
the category of each layer, so GC-5 can build the admin UI on a stable contract. Part of
the "Gestor de capas" orchestration (undp/monbo#116), unit GC-2 (undp/monbo#118).

## What Changes

- **New admin routes for categories**, scoped to the session's country like the layer
  routes:
  - `GET /admin/categories`: every category of the country, enabled or not, with its own
    threshold (`null` = the global one), its layer counts, and the problems of the
    country's `categories.json` (unreadable file, rejected entries);
  - `POST /admin/categories`: create a category with an admin-chosen slug `id`, enabled;
  - `PUT /admin/categories/{id}`: replace its editable fields (also repairs a rejected
    entry, and turns the built-in `deforestation` into a stored one);
  - `PATCH /admin/categories/{id}`: enable or disable it.
  - No delete, and ids are never reused (a taken id answers 409).
- **Rules that keep a published layer's meaning stable** (400 with a clear message):
  - a category with published layers can't be disabled, and its `polarity` can't change;
  - a category's `temporal` can't change while it has any layer;
  - a layer can't be published while its category is disabled or doesn't resolve;
  - a published layer can't move to another category.
- **`LayerInput` requires `category_id`** (**BREAKING** for admin clients): it must be a
  category of the session's country that resolves and is enabled (an edit may keep the
  layer's current, disabled category). `baseline` and `compared_against` become optional:
  required for a temporal category, and `null` for one that isn't. Both keys are always
  written to the index (GC-1's rollback rule).
- **`AdminLayer` returns `category_id`, `category_issue` and `category_enabled`**, so the
  admin can see why a layer is not public (D14).
- **Category writes never drop what they don't understand**: they replace or add one entry
  of `categories.json` and keep every other entry as stored, even a rejected one. An
  unreadable file refuses category writes (409) instead of being overwritten.
- **Contracts regenerated** (`pnpm contracts`), and the admin web form sends the layer's
  current `category_id` (`deforestation` for a new layer) so it keeps compiling and working
  until GC-5 adds the category selector.

## Capabilities

### New Capabilities

None. Categories as data are GC-1's `layer-categories`; managing them is layer
administration.

### Modified Capabilities

- `layer-administration`: new requirements for listing, creating, editing and
  enabling/disabling a country's categories; listing, creating, editing and publishing a
  layer now involve its category (`category_id`, its issue, years by `temporal`).

## Impact

- **API:**
  - `app/modules/admin/categories.py` (new router), registered in
    `app/modules/admin/__init__.py`.
  - `app/modules/admin/models.py`: `CategoryInput`, `CategoryCreate`, `AdminCategory`,
    `AdminCategories`; `LayerInput` and `AdminLayer` gain the category fields.
  - `app/modules/admin/layers.py`: category and year checks on create, edit and publish.
  - `app/modules/layers/store.py`: `put_category()`, a write of one category that keeps
    the rest of the file as stored.
- **Contracts:** `apps/api/openapi.json` and `apps/web/src/api/schema.d.ts`.
- **Web:** only `components/page/admin/layerFormState.ts` (pass `category_id` through) and
  its test. The category UI is GC-5.
- **Docs:** `docs/maps.md` (admin categories, rules), `docs/architecture.md` (admin
  routes).
- **Data:** nothing migrated. No change to the analysis, the ratio, the tiles or the
  public routes. Regression and numeric baseline pass without regeneration.
