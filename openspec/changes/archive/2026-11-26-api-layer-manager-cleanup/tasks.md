## 1. Remove the dead model

Files: apps/api/app/modules/layer_analysis/models.py

- [x] 1.1 Delete the class `DeforestationUnprocessedFarmData` (`apps/api/app/modules/layer_analysis/models.py:7-8`) and the import of `InputFarmData` if nothing else in the file uses it. Done when `grep -rn "DeforestationUnprocessedFarmData" apps tools` returns nothing.
- [x] 1.2 From `apps/api`, `uv run python -m app.openapi --check` passes and `git diff --stat` shows no change to `apps/api/openapi.json` or `apps/web/src/api/schema.d.ts`.

## 2. Pin the raster check of the listings (regression guard)

Files: apps/api/tests/modules/layers/test_countries_layout.py

Groups 1 and 2 are disjoint.

- [x] 2.1 Add `test_a_raster_removed_after_a_listing_is_hidden_on_the_next_one` to `apps/api/tests/modules/layers/test_countries_layout.py`, using the `country_root` fixture: register CO, write an index with one layer (`layer(0, "gfw.tif")`) and its raster; assert `GET /countries` returns `[{"code": "CO"}]` and `GET /maps?country=CO` lists id 0; delete the raster file (index untouched); assert the next `GET /countries` returns `[]` and the next `GET /maps?country=CO` returns `[]`.
- [x] 2.2 Regression guard (green before and after the change). Falsify it with the minimal mutant, a cache on `has_raster`, and see it red: `node "${INVENTURES_PIPELINE_HOME:-$HOME/.inventures-pipeline}/current/runtime/falsify.mjs" --file apps/api/app/modules/layers/store.py --find '    def has_raster(self, filename: str | None) -> bool:' --replace $'    @__import__("functools").cache\n    def has_raster(self, filename: str | None) -> bool:' --test apps/api/tests/modules/layers/test_countries_layout.py --expect red`.

## 3. Checks

- [ ] 3.1 From `apps/api`: `uv run pytest`, `uv run ruff check .`, `uv run black --check .`, `uv run mypy app` and `uv run python -m app.openapi --check` pass.
