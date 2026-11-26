Order: this change is first in the batch (issue #184). Groups 1–3 (API) and group 4 (web) are
disjoint; group 5 writes only test files. Every tripwire's mutant is run with
`node "${INVENTURES_PIPELINE_HOME:-$HOME/.inventures-pipeline}/current/runtime/falsify.mjs" --file <file> --find <find> --replace <replace> --test <test>`
against the post-change tree; the code it names is the code prescribed in `design.md` (D1–D7),
so write those lines as given. Every test below marked **fix tripwire** must be seen red on the
pre-change tree first (write it, run it, then implement).

## 1. Field helpers and lookups

Files: apps/api/app/modules/layers/categories.py, apps/api/app/modules/layers/store.py, apps/api/app/modules/layer_analysis/router.py, apps/api/app/modules/admin/helpers.py

- [x] 1.1 Add `layer_id_of` and `invalid_index_fields` to `layers/categories.py` and make
  `index_fields_problem` return the first of `invalid_index_fields` (design D1). Done when the
  MB-3 tests in `tests/modules/admin/test_layers.py` (section "Index fields of the wrong type")
  and `tests/modules/layers/` pass unchanged.
- [x] 1.2 `is_layer` uses `if layer_id_of(entry) != layer_id:` (D2).
- [x] 1.3 `analyze` selects with `if layer_id_of(map) in body.maps and is_layer(...)`, and
  refuses an invalid version with the `invalid_version` block of D6.
- [x] 1.4 `published_ids` and `years_mismatch` keep only entries with
  `layer_id_of(entry) is not None` (D2); `published_ids` reads
  `if is_enabled(entry) and layer_id_of(entry) is not None`. Add `refuse_invalid_fields` (D4)
  to `admin/helpers.py`.

## 2. Admin layer routes

Files: apps/api/app/modules/admin/layers.py

- [x] 2.1 `_position` uses `if layer_id_of(entry) == layer_id:` (D2).
- [x] 2.2 `create_layer` refuses with the `unaddressable` block of D3 before computing the id;
  `_free_metadata_stem` uses `if isinstance(entry.get(key), str)` (D3).
- [x] 2.3 `update_layer`: `PUT_NEEDS`, `refuse_invalid_fields(..., "edited")` on `checked`
  before the pixel size check and on `index[position]` inside the lock before
  `_check_category`; `checked.get("pixel_size")` and `index[position].get("pixel_size")` (D4).

## 3. Raster upload and ingestion job

Files: apps/api/app/modules/admin/rasters.py, apps/api/app/modules/admin/ingestion.py

- [x] 3.1 `INGESTION_NEEDS` and `_ingestion_entry` in `admin/ingestion.py` (D5); use it in
  `run_ingestion` (today line 352) and in `activate` under the lock (today line 244);
  `_layer_is_temporal` looks up with `layer_id_of(e) == layer_id`.
- [x] 3.2 Replace `_layer_exists` with `_check_upload_target` in `admin/rasters.py` (D4), with
  the line `refuse_invalid_fields(entry, layer_id, INGESTION_NEEDS, "given a raster")`, called
  where `_layer_exists` is called today (before the slot and the staging file).

## 4. Admin UI

Files: apps/web/src/components/page/admin/RasterUploadSection.tsx, apps/web/src/locales/es/admin.json, apps/web/src/locales/en/admin.json

- [x] 4.1 `uploadErrorText` shows a 400's reason with `admin:layers:refused` (D7, the
  `if (status === 400) {` block); 413 and 409 keep their texts.
- [x] 4.2 Add `raster.issues.invalid_fields` to both locales with the texts of D7.

## 5. Tests

Globs: apps/api/tests/modules/admin/test_layers.py, apps/api/tests/modules/admin/test_ingestion.py, apps/api/tests/modules/admin/test_categories.py, apps/api/tests/modules/layer_analysis/test_router.py, apps/web/src/components/page/admin/RasterUploadSection.test.tsx

Use the existing fixtures (`layers`, `GFW`, `MISSING`, `layer_body` in `test_layers.py`;
`layers`, `upload`, `job_for`, `write_tif`, `binary`, `staging` in `test_ingestion.py`). The
reproduction the planner ran used exactly these.

- [x] 5.1 `test_layers.py`:
  - (a) **Fix tripwire**: create answers 400 naming the position and value
    for an entry with `id` `"abc"`, `[7]` and missing (parametrized), and the index and metadata
    files are unchanged. Mutant: `--file apps/api/app/modules/admin/layers.py --find "if unaddressable:" --replace "if False:"`.
  - (b) **Fix tripwire**: create answers 201 with the next id when layer 7
    has `attributes_filename: 5`. Mutant: `--file apps/api/app/modules/admin/layers.py --find "if isinstance(entry.get(key), str)" --replace "if entry.get(key)"`.
  - (c) **Fix tripwire**: with an id-less entry first, `PUT` and `PATCH` of
    layer 0 answer 200 (parametrized). Mutant: `--file apps/api/app/modules/admin/layers.py --find "if layer_id_of(entry) == layer_id:" --replace "if entry[\"id\"] == layer_id:"`.
  - (d) **Fix tripwire**: `PUT` of layer 7 with `attributes_filename: 5`,
    `considerations_filename: 5` and `raster_filename: 5` (parametrized) answers 400 naming layer 7
    and the field, and no metadata file of layer 7 exists or changed (the considerations case is
    the partial write). Mutant: `--file apps/api/app/modules/admin/helpers.py --find "if refused:" --replace "if False:"`.
    The `raster_filename` case is green pre-change when the pixel size doesn't change (200, the
    planner reproduced it): parametrize it with `pixel_size: 31` so it is red pre-change, or mark
    it a regression guard.
  - (e) **Fix tripwire**: `PUT` of layer 7 without `pixel_size` and with
    `pixel_size: 31` answers 200 and stores 31. Mutant: `--file apps/api/app/modules/admin/layers.py --find "checked.get(\"pixel_size\")" --replace "checked[\"pixel_size\"]"`.
- [x] 5.2 `test_categories.py`:
  - (f) **Fix tripwire**: `GET /admin/categories` answers 200 with an
    enabled id-less entry in `deforestation`, and `publishedLayerCount` leaves it out. Mutant:
    `--file apps/api/app/modules/admin/helpers.py --find "if is_enabled(entry) and layer_id_of(entry) is not None" --replace "if is_enabled(entry)"`.
- [x] 5.3 `test_ingestion.py`:
  - (g) **Fix tripwire**: upload to a layer whose `version` is `"abc"`,
    `"3"`, and whose `pixel_size` is missing (parametrized) answers 400 naming the field; no job
    file and no staging file remain. Mutant: `--file apps/api/app/modules/admin/rasters.py --find "refuse_invalid_fields(entry, layer_id, INGESTION_NEEDS, \"given a raster\")" --replace "None"`.
  - (h) **Fix tripwire**: with an id-less entry first, an upload to
    layer 0 is accepted (202) and the job succeeds. Mutant: `--file apps/api/app/modules/admin/ingestion.py --find "entry = next((e for e in index or [] if layer_id_of(e) == layer_id), None)" --replace "entry = next((e for e in index or [] if e[\"id\"] == layer_id), None)"`.
  - (i) **Fix tripwire**: `activate` on an index whose entry has
    `version: "3"` raises `IngestionError` with code `invalid_fields` and `params["field"] ==
    "version"`, leaves the index unchanged and no file under the share's staging folder. Call
    `activate` directly with a COG written by `write_tif`. Mutant: `--file apps/api/app/modules/admin/ingestion.py --find "if stale_fields:" --replace "if False:"`.
- [x] 5.4 `tests/modules/layer_analysis/test_router.py`:
  - (j) **Fix tripwire**: with an id-less entry first in CO, the analysis
    of `maps: [0]` answers 200 with layer 0's result. Mutant: `--file apps/api/app/modules/layer_analysis/router.py --find "if layer_id_of(map) in body.maps and" --replace "if map[\"id\"] in body.maps and"`.
  - (k) **Fix tripwire**: with an id-less entry first in CO, a tile of
    layer 0 answers 200. Mutant: `--file apps/api/app/modules/layers/store.py --find "if layer_id_of(entry) != layer_id:" --replace "if entry[\"id\"] != layer_id:"`.
  - (l) **Fix tripwire**: CO without a layer 1 and with an entry whose
    `id` is `true`: the analysis of `maps: [1]` answers 400. Mutant: `--file apps/api/app/modules/layers/categories.py --find "return layer_id if _is_int(layer_id) else None" --replace "return layer_id if isinstance(layer_id, int) else None"`.
  - (m) **Fix tripwire**: CO's layer 0 with `version: "abc"`: the analysis
    answers 400 naming layer 0 and `version`. Mutant: `--file apps/api/app/modules/layer_analysis/router.py --find "if invalid_version:" --replace "if False:"`.
- [x] 5.5 `RasterUploadSection.test.tsx`:
  - (n) **Fix tripwire**: an upload rejected with
    `AdminApiError(400, "Layer 9 can't be given a raster: …")` shows "The server refused the
    change: Layer 9 …"; a 413 still shows the too-large text. Mutant: `--file apps/web/src/components/page/admin/RasterUploadSection.tsx --find "if (status === 400) {" --replace "if (false) {"`.
  - (o) **Fix tripwire**: a job that fails with
    `{ code: "invalid_fields", params: { field: "version" } }` shows the locale's text with
    `version` (Spanish UI), not the API's English message. Mutant: `--file apps/web/src/locales/es/admin.json --find "\"invalid_fields\":" --replace "\"invalid_fields_x\":"`.
- [x] 5.6 Run `uv run pytest`, `uv run ruff check .`, `uv run black --check .`,
  `uv run mypy app` and `uv run python -m app.openapi --check` in `apps/api` (the last one must
  report no change), and `pnpm exec vitest run src/components/page/admin src/locales` plus
  `pnpm exec tsc --noEmit` in `apps/web`.
