## 1. API: category-aware validation

- [x] 1.1 Add `is_temporal(category_id, file)` to `app/modules/layers/categories.py`: resolves against `effective_categories(file)`; unresolved categories are not temporal
- [x] 1.2 Make `validate_raster` take a required keyword `temporal: bool`; report `loss_years` only when it is true, `not_binary` otherwise
- [x] 1.3 Generic messages in `processing.py`: `not_integer`, `not_binary` / `loss_years` legend (`0 = outside the layer, 1 = inside the layer`), the years hint
- [x] 1.4 Rename `nodata_is_loss` to `nodata_is_positive` and `no_loss_pixels` to `no_positive_pixels`, with generic messages
- [x] 1.5 `run_ingestion`: read the layer's `category_id` (defaulted to `deforestation`) and the country's categories before the scan, and pass `temporal`
- [x] 1.6 `seed.py`: pass `temporal` from each entry's category resolved against `CategoriesFile()` (flat layout)

## 2. Admin texts

- [x] 2.1 `apps/web/src/locales/{es,en}/admin.json`: rewrite `raster.intro` and `raster.issues` for `not_integer`, `not_binary`, `loss_years`; add `nodata_is_positive` and `no_positive_pixels`; remove the old two keys

## 3. Tests

- [x] 3.1 Ingestion tests: year values in a temporal layer give `loss_years`; in a non-temporal layer and in a layer with an unknown category give `not_binary` without the years hint
- [x] 3.2 Ingestion tests: an empty mask warns `no_positive_pixels` in both a temporal and a non-temporal layer; nodata 1 fails with `nodata_is_positive` in both
- [x] 3.3 Messages: `not_binary` describes `0 = outside the layer, 1 = inside the layer`; no ingestion message mentions loss or deforestation for a non-temporal layer
- [x] 3.4 Unit tests for `is_temporal` (built-in, stored temporal, stored non-temporal, disabled, unknown, invalid, unreadable)
- [x] 3.5 Update existing callers of `validate_raster` in tests; seed tests still pass

## 4. Docs

- [x] 4.1 `docs/maps.md`: retitle to "Map layers"; generic intro and "Raster requirements" (mask wording, nodata rule, years hint only for temporal categories, the warning)

## 5. Checks

- [x] 5.1 `git lfs pull`; API: `uv run pytest` (regression and numeric baseline not regenerated), `ruff check .`, `black --check .`, `mypy app`, `python -m app.openapi --check`
- [x] 5.2 Web: schema check, `tsc --noEmit`, `pnpm run lint`, `pnpm test` (locale parity), `pnpm run build`
- [x] 5.3 `openspec validate generic-raster-ingestion --strict`
