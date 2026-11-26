Groups 1, 2 and 3 write disjoint files; group 2's contract regeneration (2.4) also writes
`apps/web/src/api/schema.d.ts`, which group 3 only reads. Tripwires run with
`node "${INVENTURES_PIPELINE_HOME:-$HOME/.inventures-pipeline}/current/runtime/falsify.mjs" --file <file> --find <find> --replace <replace> --test <test>`.
A **fix tripwire** must be seen red on the pre-change tree before its fix; a **regression
guard** is falsified by its mutant on the post-change tree. The code shape the mutants match is
in `design.md`, "Code shape".

## 1. API: the check and the public listing

Globs: apps/api/app/modules/layers/categories.py, apps/api/app/modules/layers/store.py, apps/api/tests/modules/layers/test_categories.py, apps/api/tests/modules/admin/test_layers.py

- [x] 1.1 Add `PIXEL_SIZE_MAX`, `invalid_fields` to `LayerIssue`, `_is_int`, `_is_number` and `index_fields_problem(entry)` to `app/modules/layers/categories.py`, as in `design.md`. Use `PIXEL_SIZE_MAX` in `LayerInput.pixel_size` (`app/modules/admin/models.py`, group 2).
- [x] 1.2 Unit tests in `tests/modules/layers/test_categories.py`: `index_fields_problem` returns None for a valid entry (int and float pixel sizes, `version: 0`, no `references`, `raster_filename: None`) and the field's name for each invalid value: `id` `"abc"`/`True`; `version` `"abc"`/`"3"`/`True`/`-1`; `pixel_size` `"abc"`/`"30"`/`True`/`0`/`-5`/`10001`/`float("inf")`/`float("nan")`; `references` `"x"`/`[1, 2]`/`None`; `raster_filename` `5`; `attributes_filename` `5`/missing; `considerations_filename` `5`/missing.
  - Regression guard (strict booleans). Mutant: `--file apps/api/app/modules/layers/categories.py --find "isinstance(value, int) and not isinstance(value, bool)" --replace "isinstance(value, int)" --test apps/api/tests/modules/layers/test_categories.py`.
  - Regression guard (pixel size range). Mutant: `--find "0 < pixel_size <= PIXEL_SIZE_MAX" --replace "pixel_size <= PIXEL_SIZE_MAX"` on the same file and test.
- [x] 1.3 In `LayersRoot._with_categories` (`store.py`), tag `invalid_fields` before `years_mismatch` and log it once through `_log_hidden` with the field, as in `design.md`. `is_public` already checks `layer_issue` before `has_raster`; keep it that way.
- [x] 1.4 Tests in `tests/modules/admin/test_layers.py`, parametrized over CO's layer 7 with `version: "abc"`, `pixel_size: "abc"`, `references: "x"`, `references: [1, 2]`, `raster_filename: 5`, `attributes_filename: 5`, `considerations_filename: 5`, `id: "abc"`: `GET /maps?country=CO` and `GET /maps` answer 200, without layer 7 and with CO's layer 0 and EC's layer 2; `GET /countries` answers 200 and still offers CO and EC; the log has one error naming layer 7 and the field (`caplog`), and a second request doesn't log it again.
  - Fix tripwire: red on the pre-change tree (500). Mutant on the post-change tree: `--file apps/api/app/modules/layers/store.py --find "layer[\"layer_issue\"] = \"invalid_fields\"" --replace "layer[\"layer_issue\"] = None" --test apps/api/tests/modules/admin/test_layers.py`.
- [x] 1.5 Test: the strict cases (`version: "3"`, `version: True`, `pixel_size: "30"`, `pixel_size: 0`) are not listed by `GET /maps?country=CO`. Fix tripwire: red pre-change (they are listed today). Mutant: `--find "return \"version\"" --replace "pass"` on `categories.py` with `tests/modules/admin/test_layers.py`.

## 2. API: the admin and the contract

Globs: apps/api/app/modules/admin/layers.py, apps/api/app/modules/admin/models.py, apps/api/openapi.json, apps/web/src/api/schema.d.ts, apps/api/tests/modules/admin/test_layers.py

- [x] 2.1 `AdminLayer.pixel_size: float | None`, `AdminLayer.version: int | None`, and the `layer_issue` description naming `invalid_fields` (`app/modules/admin/models.py`); `LayerInput.pixel_size` uses `le=PIXEL_SIZE_MAX`.
- [x] 2.2 `_to_admin_layer`: `layer_issue = "invalid_fields"` first; show `pixel_size`/`version` as None when invalid, `references` as `[]`, `raster_filename` as None with `has_raster: false`, and the attributes/considerations of an invalid file name as None. `list_layers` leaves out (and logs once per request is fine, via `logger.error`) entries whose `index_fields_problem` is `"id"`.
- [x] 2.3 `set_layer_enabled`: before the raster check, `if body.enabled and fields_problem is not None:` → 400 naming the field.
- [x] 2.4 Tests in `tests/modules/admin/test_layers.py`:
  - For each case of 1.4 except `id`, `GET /admin/layers` answers 200 and layer 7 has `layer_issue: "invalid_fields"` with the bad field shown empty (`version`/`pixel_size` null, `references` `[]`, `raster_filename` null, attributes/considerations null). Fix tripwire: red pre-change (500). Mutant: `--file apps/api/app/modules/admin/layers.py --find "layer_issue = \"invalid_fields\"" --replace "layer_issue = None" --test apps/api/tests/modules/admin/test_layers.py`.
  - With `id: "abc"`, `GET /admin/layers` answers 200 with CO's other layers. Fix tripwire: red pre-change. Mutant: `--find "!= \"id\"" --replace "!= \"never\""` on `admin/layers.py`, same test.
  - `PATCH /admin/layers/7 {"enabled": true}` with `version: "abc"` (raster present) and with `raster_filename: 5` answers 400, and the index is unchanged; `{"enabled": false}` answers 200. Fix tripwire: red pre-change (200 / 500). Mutant: `--find "if body.enabled and fields_problem is not None:" --replace "if False:"` on `admin/layers.py`, same test.
- [x] 2.5 Regenerate the contract with `pnpm contracts` (`apps/api/openapi.json`, `apps/web/src/api/schema.d.ts`); `uv run python -m app.openapi --check` and `tests/test_openapi.py` pass.

## 3. Web admin

Globs: apps/web/src/components/page/admin/layerVisibility.ts, apps/web/src/components/page/admin/layerVisibility.test.ts, apps/web/src/components/page/admin/layerFormState.ts, apps/web/src/components/page/admin/layerFormState.test.ts, apps/web/src/components/page/admin/AdminLayersPageContent.tsx, apps/web/src/components/page/admin/AdminLayerPages.test.tsx, apps/web/src/locales/es/admin.json, apps/web/src/locales/en/admin.json, apps/web/src/test/factories.ts

- [x] 3.1 `LayerBlocker` gains `"invalid_fields"` (under `layer_issue`); the texts of `design.md` go in `status.reasons`, `status.fixes` and `status.fixesPublished` of both locales.
- [x] 3.2 `AdminLayersPageContent.tsx` shows `{layer.version ?? "—"}`; `layerFormState.ts` starts `pixel_size` as `layer.pixel_size === null ? "" : String(layer.pixel_size)` for an existing layer (still `"30"` for a new one).
- [x] 3.3 Tests:
  - `layerVisibility.test.ts`: `layer_issue: "invalid_fields"` is the blocker, and a category issue still wins over it. Regression guard (the function passes `layer_issue` through). Mutant: `--file apps/web/src/components/page/admin/layerVisibility.ts --find "return layer.layer_issue;" --replace "return null;" --test apps/web/src/components/page/admin/layerVisibility.test.ts`.
  - `AdminLayerPages.test.tsx`: an enabled layer with `layer_issue: "invalid_fields"` and `version: null` shows "—" as its version and the English reason and fix in the list. Fix tripwire: red pre-change (no text, empty cell). Mutants: `--file apps/web/src/components/page/admin/AdminLayersPageContent.tsx --find "{layer.version ?? \"—\"}" --replace "{layer.version}"`, and `--file apps/web/src/locales/en/admin.json --find "\"invalid_fields\": \"its index entry has fields of an invalid type.\"" --replace "\"invalid_fieldz\": \"its index entry has fields of an invalid type.\""`, both with `--test apps/web/src/components/page/admin/AdminLayerPages.test.tsx`.
  - `layerFormState.test.ts`: an existing layer with `pixel_size: null` starts with `""`, a new one with `"30"`. Fix tripwire: red pre-change (`"null"`). Mutant: `--file apps/web/src/components/page/admin/layerFormState.ts --find "layer.pixel_size === null ? \"\" : " --replace "" --test apps/web/src/components/page/admin/layerFormState.test.ts`.
  - `src/locales/locales.test.ts` (existing) keeps both locales in parity.

## 4. Checks

Files: openspec/changes/hide-layers-with-invalid-fields/tasks.md

- [x] 4.1 With the real index (`MAPS_ROOT` unset), `GET /maps` (no filter, `country=CO`, `CR`, `EC`, `language=es`, `country=CO&language=es`) and `GET /countries` answer the same bytes as before the change: compare the SHA-256 of each body against the snapshot taken on `478defc` (listed in the PR body).
- [ ] 4.2 Run the CI checks of both apps (`apps/api`: `uv run pytest`, `uv run ruff check .`, `uv run black --check .`, `uv run mypy app`, `uv run python -m app.openapi --check`; `apps/web`: schema check, `pnpm exec tsc --noEmit`, `pnpm run lint`, `pnpm test`, `pnpm run build`).
