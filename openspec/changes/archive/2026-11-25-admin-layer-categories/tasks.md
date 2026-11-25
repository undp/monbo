## 1. Storage

- [x] 1.1 Add `LayerStore.put_category(category, *, first=False)` and `CategoriesUnreadable` in `app/modules/layers/store.py`: under the lock, read the raw `categories.json` (missing = `[]`), refuse an unreadable file, validate the entry with `StoredCategory`, replace the first entry with that id and drop its other copies (or insert it first/last), write atomically and refresh the cache from the written content
- [x] 1.2 Store tests: insert, replace in place, duplicates collapsed, rejected entries and entries without an id kept verbatim, `first=True`, unreadable and I/O-error files refused without writing, invalid entry refused, cache refreshed in the same mtime tick

## 2. Admin models

- [x] 2.1 Export from `app/modules/layers/categories.py` the limits `StoredCategory` uses (lengths, color pattern, threshold range), so the admin inputs share them
- [x] 2.2 In `app/modules/admin/models.py`, add `CategoryInput`, `CategoryCreate`, `AdminCategory` and `AdminCategories` (camelCase, `_Strict` inputs, `json_schema_serialization_defaults_required` on responses), reusing `LocalizedText`, `ResultLabels`, `CategoryIcon` and `CategoryPolarity`
- [x] 2.3 `LayerInput`: required `category_id` (slug pattern); optional `baseline`/`compared_against` with both-or-neither and `baseline ≤ compared_against` (422)
- [x] 2.4 `AdminLayer`: `category_id`, `category_issue` (GC-1's `CategoryIssue` or null) and `category_enabled`

## 3. Admin category routes

- [x] 3.1 Create `app/modules/admin/categories.py` with `GET`, `POST`, `PUT /{id}`, `PATCH /{id}` scoped to `session.country`, and register it under `/admin/categories` in `app/modules/admin/__init__.py`
- [x] 3.2 Helpers: per-category layer counts from `read_index()`; stored ↔ `AdminCategory` conversion; "is synthesized deforestation" → store it first
- [x] 3.3 Rules under `store.locked()`: 409 taken id (valid, rejected or `deforestation`) and unreadable file; 404 unknown id; 400 disable with published layers, polarity change with published layers, temporal change with any layer, `PATCH` on a rejected entry; messages name the layers
- [x] 3.4 Log every category write with the country and id through the admin logger

## 4. Admin layer routes

- [x] 4.1 `_to_admin_layer` adds `category_id`, `category_issue`, `category_enabled` from the country's categories (one `read_categories()` per request)
- [x] 4.2 `POST`/`PUT /admin/layers`: 400 when the category doesn't resolve, is disabled (except a `PUT` keeping the current category), when years don't match `temporal`, or when a published layer changes category; checked inside the lock before any metadata is written
- [x] 4.3 `_apply_input` writes `category_id` and always both year keys (strings or `null`)
- [x] 4.4 `PATCH /admin/layers/{id}` enabling: 400 when the category doesn't resolve or is disabled (after the raster 409)

## 5. API tests

- [x] 5.1 `tests/modules/admin/test_categories.py`: list (built-in only, counts, rejected entry and unreadable file reported); create (201, taken ids incl. `deforestation` and rejected ids → 409, 422 cases, same id in another country); edit (threshold on built-in stores it first, polarity/temporal rules, texts always, repair of a rejected id, 404 for another country); enable/disable (400 with published layers naming them, disable without published, built-in stored first, 400 on a rejected entry); unreadable file → 409 on every write and file untouched; an EC session never sees or changes CO's categories
- [x] 5.2 Extend `tests/modules/admin/test_layers.py`: `category_id` and issue fields in listings; create with a category of another country or disabled → 400; years by `temporal` (400 both ways, `null` keys written); 422 without `category_id` and with one year; move a hidden layer, refuse moving a published one, keep a disabled current category; enable with a disabled or broken category → 400
- [x] 5.3 Update existing admin tests and fixtures that post `LayerInput` without `category_id`
- [x] 5.4 End-to-end test of the acceptance criterion: CO creates "Áreas protegidas" (`avoid`) and "Frontera agrícola" (`required`, threshold 0) and a layer in each, publishes them, `GET /maps?country=CO` and `GET /categories?country=CO` show them, and an EC session doesn't see them

## 6. Contracts and web bridge

- [x] 6.1 `pnpm contracts` to regenerate `apps/api/openapi.json` and `apps/web/src/api/schema.d.ts`
- [x] 6.2 Export the new admin types in `apps/web/src/interfaces/AdminLayer.ts` (re-exports only)
- [x] 6.3 `layerFormState.ts` keeps and sends the layer's `category_id` (`deforestation` for a new layer); update its test

## 7. Docs

- [x] 7.1 `docs/maps.md`: managing categories in the admin (routes, rules of decision 4, repair of a rejected entry, unreadable file needs operations), the layer's category and years by `temporal`
- [x] 7.2 `docs/architecture.md`: the admin category routes next to the layer routes
- [x] 7.3 Check `CLAUDE.md` and `docs/onboarding.md` for statements this changes

## 8. Checks

- [x] 8.1 API: `uv sync --frozen`, `uv run pytest` (regression and numeric baseline green without regeneration), `ruff check`, `black --check`, `mypy app`, `python -m app.openapi --check`
- [x] 8.2 Web: `pnpm install --frozen-lockfile`, schema check, `tsc --noEmit`, `lint`, `test`, `build`
- [x] 8.3 `openspec validate admin-layer-categories`

## 9. Review fixes (#138)

- [x] 9.1 Repairing a rejected category and creating one over existing layers require the layers hidden and their years to fit (`_check_adopted_layers`); publishing re-checks the years
- [x] 9.2 A repair keeps the stored `enabled` (`put_category(keep_enabled=True)`)
- [x] 9.3 `years_fit`: both years for a temporal category, none otherwise
- [x] 9.4 Enabling a category with published layers answers 400
- [x] 9.5 Read-side invariant: `LayersRoot.is_public` also requires years that fit and the raster; `layer_issue` tag and `AdminLayer.layer_issue`; tests with hand-edited indexes
- [x] 9.6 Years fit by the rules of `LayerInput` (shared `YEAR_MIN`/`YEAR_MAX`, `years_problem`); `enabled` counts only as the boolean `true` everywhere (`is_enabled`); `GET /maps` filters by country before checking rasters; `GET /admin/layers` shows an unreadable year as `null` with `years_mismatch`
