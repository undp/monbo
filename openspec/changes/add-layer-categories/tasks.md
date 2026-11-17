## 1. Category model and storage

- [x] 1.1 Add `app/modules/layers/categories.py`: `DEFAULT_CATEGORY_ID`, the icon catalog, `StoredCategory` (and its localized text and result-label models) with the field rules of design decision 2, the `CategoriesFile` result (`readable`, `categories`, `invalid_ids`, `errors`), `parse_categories(content)` with per-entry validation and duplicated ids rejected, the built-in `deforestation` category, `effective_categories(file)` (no built-in when the stored one is invalid or the file unreadable) and the `category_issue` codes
- [x] 1.2 `LayerStore`: `categories_path`, `read_categories()` (same lock and mtime/size cache as the index; missing file is readable and empty; each problem logged once per file version) and `write_categories()` through `_atomic_write`
- [x] 1.3 `_with_defaults`: default `category_id` to `deforestation`
- [x] 1.4 `LayersRoot`: `country_categories(code)` (effective categories; built-in only in the flat layout) and, in `layers()` and `country_layers()`, tag each entry with `category_issue` and `category_enabled`, logging each issue with country, layer and category; `public_countries()` counts only layers `GET /maps` would list
- [x] 1.5 Tests in `tests/modules/layers/`: missing file gives the built-in category; stored `deforestation` wins; invalid polarity, threshold below 0 or above 100, bad icon or color each reject only that category; duplicated ids reject every copy; an unparseable file resolves nothing (no built-in) and tags `unreadable_categories`; an invalid stored `deforestation` is not replaced by the built-in; an unknown `category_id` tags only that layer and leaves the country's other layers readable; tags are never written back by `write_index`; the cache picks up a rewritten file; the flat layout tags a non-`deforestation` category `unknown_category`

## 2. Public contract

- [x] 2.1 Add `app/models/categories.py`: `LocalizedText`, `ResultLabels`, `LayerCategory` (camelCase, `icon` and `polarity` as enums, `json_schema_serialization_defaults_required`)
- [x] 2.2 `BaseMapData` gains `categoryId: str`; `GET /maps` reads the years with `.get()`, sets `categoryId` and leaves out layers whose category is disabled or has a `category_issue`
- [x] 2.3 Add `app/modules/maps/categories.py` with `GET /categories?country=CC` (required country, enabled categories that resolve, resolved `thresholdPercentage`, `[]` for unknown or disabled countries, flat-layout rule, 500 only when the index is unreadable) and register it in `app/modules/maps/__init__.py`
- [x] 2.4 Endpoint tests: the Git-tracked flat root gives `deforestation` for CO and `categoryId: "deforestation"` on every CO layer; another country's categories and disabled categories are not listed; unknown and disabled countries give `[]`; missing country gives 422; a layer of a disabled or unknown category is not in `GET /maps` and still analyzes by id; a country whose only layer has a broken category is not in `GET /countries`; an invalid categories file doesn't make `GET /categories` or `GET /maps` fail; a layer without years lists `null`
- [x] 2.5 Run `pnpm contracts` and commit `apps/api/openapi.json` and `apps/web/src/api/schema.d.ts` with the models; `tests/test_openapi.py` passes

## 3. Rollback check

- [x] 3.1 Build a scratch per-country root with `category_id` on every entry, a `categories.json` and a layer with `null` years; run the `origin/dev` (pre-change) API against it and record what `GET /maps`, an analysis, a tile and the admin layer list and edit return
- [x] 3.2 Record the result in the PR body and keep design's rollback table accurate

## 4. Docs

- [x] 4.1 `docs/maps.md`: `categories.json` in the per-country layout tree, a "Categories" section (fields, built-in `deforestation`, polarity, threshold fallback, `GET /categories`), `category_id` and optional years in "The index", and the rollback procedure
- [x] 4.2 Check `CLAUDE.md` and `docs/onboarding.md` for statements this change makes false and update them

## 5. Verification

- [x] 5.1 `apps/api`: `uv run pytest` (regression and `tests/test_numeric_baseline.py` green without regenerating), `uv run ruff check .`, `uv run black --check .`, `uv run mypy app`, `uv run python -m app.openapi --check`
- [x] 5.2 `apps/web`: schema check, `pnpm exec tsc --noEmit`, `pnpm run lint`, `pnpm test`, `pnpm run build`
- [x] 5.3 `openspec validate add-layer-categories --strict`
