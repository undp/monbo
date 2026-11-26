## Context

`index_fields_problem` (`apps/api/app/modules/layers/categories.py:253-280`) already knows which
index field of an entry has an invalid type, and MB-3 uses it so the listings skip or tag such
entries (`admin/layers.py:238-246` leaves id-invalid entries out of the admin listing; publishing
answers 400 naming the field, `admin/layers.py:358-364`). Every other reader still indexes the
entry directly:

| Reader | Code | Breaks on |
|---|---|---|
| `_position` (PUT, PATCH) | `admin/layers.py:46-50` `entry["id"] == layer_id` | entry without `id` before the layer |
| `create_layer` | `admin/layers.py:292` `max(entry["id"] …)` | any non-int / missing `id` |
| `_free_metadata_stem` | `admin/layers.py:255-259` `Path(entry[key]).stem … if entry.get(key)` | another entry's non-string file name |
| `update_layer` | `admin/layers.py:323` `checked["pixel_size"]`, `:331` | missing `pixel_size` |
| `_apply_input` | `admin/layers.py:106-132` → `store.write_attributes` → `_is_safe_filename` (`layers/store.py:89-91`, `Path(name)`) | non-string file names; writes `en` attributes before failing on considerations |
| `_layer_exists` | `admin/rasters.py:25-29` | entry without `id` |
| `activate` | `admin/ingestion.py:244-249` (`e["id"]`, `entry["pixel_size"]`, `entry["version"] + 1`) | missing `id`, invalid `version`/`pixel_size` → job `unexpected` |
| `_layer_is_temporal` | `admin/ingestion.py:285` | entry without `id` |
| `run_ingestion` | `admin/ingestion.py:352-356` | entry without `id`, missing `pixel_size` |
| `published_ids`, `years_mismatch` | `admin/helpers.py:62-73` | entry without `id` (GET /admin/categories, category writes) |
| `is_layer` | `layers/store.py:523-531` `entry["id"] != layer_id` | entry without `id` (tiles, images via `maps/helpers.py:66-83`) |
| `analyze` | `layer_analysis/router.py:40-45` `map["id"] in body.maps` | entry without `id`; `version` echoed into `LayerResults.version: int` (`layer_analysis/models.py:24`) |

`run_ingestion` already turns any other exception into the job code `unexpected`.
`JobIssue.code` is a free `str` (`admin/models.py:282`), so a new code is not a contract change.
The web translates job codes with `admin:raster:issues:<code>` and falls back to the API's
English message (`apps/web/src/components/page/admin/RasterUploadSection.tsx:61-71`), and shows
a 400 on the upload as the generic error (`RasterUploadSection.tsx:73-82`).
`apiRefusalReason` (`components/page/admin/adminErrors.ts:18-23`) already extracts a 400's
string detail for publishing.

## Goals / Non-Goals

**Goals:** no 500 from an invalid index entry on any route above; one entry never takes down
the rest of its country; every refusal names the entry or the layer and the field; nothing is
half-written.

**Non-Goals:** see the proposal (no automatic repair, no CLI changes, no listing changes, no
contract change).

## Decisions

### D1. Two helpers next to `index_fields_problem`

In `app/modules/layers/categories.py`:

```python
def layer_id_of(entry: dict) -> int | None:
    """The entry's id when it is an integer (not a boolean); None for a hand edit
    that can't name a layer."""
    layer_id = entry.get("id")
    return layer_id if _is_int(layer_id) else None


def invalid_index_fields(entry: dict) -> list[str]:
    """Every index field with an invalid type, in the order index_fields_problem
    reports them."""
```

`index_fields_problem` becomes `problems = invalid_index_fields(entry); return problems[0] if
problems else None`, so the MB-3 order (id, version, pixel_size, references, raster_filename,
attributes_filename, considerations_filename) and every MB-3 test stay as they are.

*Rejected:* a per-route `try/except (KeyError, TypeError)`: it would hide which field is wrong
and could catch real bugs.

### D2. Lookups use `layer_id_of`

- `is_layer` (`layers/store.py:527`): `if layer_id_of(entry) != layer_id: return False`.
- `analyze` (`layer_analysis/router.py:43`): `if layer_id_of(map) in body.maps and
  is_layer(...)`. `None in body.maps` is false, so the entry is skipped.
- `_position` (`admin/layers.py:48`): `if layer_id_of(entry) == layer_id:`.
- `admin/rasters.py` and the three lookups in `admin/ingestion.py` (244, 285, 352):
  `layer_id_of(e) == layer_id`.
- `published_ids` and `years_mismatch` (`admin/helpers.py:62-73`) keep only entries with
  `layer_id_of(entry) is not None`. Such an entry is never public (MB-3 tags it
  `invalid_fields`), so it neither counts as published nor blocks a category change; it can't
  be named in a message anyway.

### D3. Create refuses while an id is invalid

Before computing the id, inside the lock, after `_check_category`:

```python
unaddressable = [
    (position, entry) for position, entry in enumerate(index) if layer_id_of(entry) is None
]
if unaddressable:
    position, entry = unaddressable[0]
    shown = repr(entry["id"]) if "id" in entry else "missing"
    raise HTTPException(
        status_code=400,
        detail=f"Can't create a layer in {session.country}: the index entry at "
        f"position {position} has an invalid 'id' ({shown}); fix it in the index first",
    )
```

`_free_metadata_stem` reads only string names: `if isinstance(entry.get(key), str)` instead of
`if entry.get(key)` (`admin/layers.py:258`).

*Rejected:* skipping the entry and taking `max` of the valid ids. The entry is still in the
file; when the operations team repairs `"3"` to `3`, two layers would share id 3, and
`CLAUDE.md` forbids reusing an id.

### D4. One shared refusal for operations that need a field

In `app/modules/admin/helpers.py`:

```python
def refuse_invalid_fields(
    entry: dict, layer_id: int, needed: tuple[str, ...], action: str
) -> None:
    """400 naming the first field `needed` that is invalid in the entry."""
    refused = [field for field in invalid_index_fields(entry) if field in needed]
    if refused:
        raise HTTPException(
            status_code=400,
            detail=f"Layer {layer_id} can't be {action}: its index field "
            f"'{refused[0]}' is invalid; the operations team must fix it in the index",
        )
```

- `update_layer`: `PUT_NEEDS = ("attributes_filename", "considerations_filename",
  "raster_filename")`. Called on `checked` before the pixel size check (outside the lock) and
  again on `index[position]` inside the lock, before `_check_category` and `_apply_input`, so
  nothing is written. `checked["pixel_size"]` and `index[position]["pixel_size"]` become
  `.get("pixel_size")`: a missing value differs from the body's, so the raster check runs and
  `PUT` repairs it.
- The raster upload: `INGESTION_NEEDS = ("version", "pixel_size", "raster_filename")` in
  `admin/ingestion.py`. `_layer_exists` becomes `_check_upload_target(country, layer_id) ->
  None` in `admin/rasters.py`: 500 when the index can't be read (as today), 404 when no entry
  has the id, then `refuse_invalid_fields(entry, layer_id, INGESTION_NEEDS, "given a raster")`.
  It runs where `_layer_exists` runs today, before the slot is taken and the body is staged.

### D5. The job re-checks and fails with `invalid_fields`

In `admin/ingestion.py`, one helper used by `run_ingestion` (line 352) and `activate`
(line 244, under the lock):

```python
def _ingestion_entry(index: list[dict] | None, layer_id: int) -> dict:
    entry = next((e for e in index or [] if layer_id_of(e) == layer_id), None)
    if entry is None:
        raise IngestionError("layer_not_found", "The layer no longer exists")
    stale_fields = [
        field for field in invalid_index_fields(entry) if field in INGESTION_NEEDS
    ]
    if stale_fields:
        raise IngestionError(
            "invalid_fields",
            f"The layer's index field '{stale_fields[0]}' is invalid",
            field=stale_fields[0],
        )
    return entry
```

`activate`'s `finally` (`admin/ingestion.py:261-262`) still unlinks the share staging file, and
the job's own cleanup still removes the local one.

### D6. Analysis refuses an invalid version

After `unknown` is checked in `analyze`:

```python
invalid_version = [
    map["id"] for map in requested_maps if "version" in invalid_index_fields(map)
]
if invalid_version:
    raise HTTPException(
        status_code=400,
        detail=f"Layers {invalid_version} of {body.country or 'the request'} can't be "
        "analyzed: their index field 'version' is invalid",
    )
```

This applies the approved rule (an operation that needs an invalid field answers 400) to the
one public route that needs it; the issue didn't list it, the planner found it while mapping.
Tiles and images don't read `version` unless the client sends one (`router.py:161` compares it
and answers 409), so they need no change.

*Rejected:* returning the results with `version: null`. `LayerResults.version` is required by
the contract (`layer_analysis/models.py:24`) and the web uses it to invalidate results.

### D7. Web

- `RasterUploadSection.tsx` `uploadErrorText`: on a 400 with a reason, show
  `t("admin:layers:refused", { detail: reason, ...AS_TEXT })`:

  ```ts
  if (status === 400) {
    const reason = apiRefusalReason(error);
    if (reason) return t("admin:layers:refused", { detail: reason, ...AS_TEXT });
  }
  ```

- `locales/{es,en}/admin.json` `raster.issues.invalid_fields`, with `{{field}}`:
  - en: "The layer's index entry has an invalid “{{field}}”. The operations team must fix it in the index."
  - es: "La entrada de la capa en el índice tiene un “{{field}}” inválido. El equipo de operaciones debe corregirla en el índice."

## API contract

No model changes. New status codes:

| Route | New answer | Before |
|---|---|---|
| `POST /admin/layers` | 400 when an entry's `id` is invalid | 500 |
| `PUT /admin/layers/{id}` | 400 when the layer's file names are invalid; 200 repairing `pixel_size` | 500 |
| `PUT`/`PATCH /admin/layers/{id}` with an id-less entry before it | 200 | 500 |
| `PUT /admin/layers/{id}/raster` | 400 when `version`/`pixel_size`/`raster_filename` is invalid; 202 with an id-less entry before it | 202 + `unexpected` / 500 |
| `GET /admin/categories` | 200 | 500 |
| `POST /layer_analysis/analyze` | 200 with an id-less entry in the country; 400 when a requested layer's `version` is invalid | 500 |
| tiles, `generate-image` | resolve with an id-less entry in the country | 500 |

New job error code: `invalid_fields` (params: `field`).

## Data shape / cross-stack wiring

Data shape: N/A, `index.json` is read as it is and never rewritten to fix an entry.
Cross-stack: only the two web edits of D7; no generated types change.

## Signal tracing

The job code `invalid_fields`:
- **Emitter:** `_ingestion_entry` in `admin/ingestion.py`, inside `run_ingestion` and `activate`.
- **Consumer:** `RasterUploadSection.tsx` `issueText`, which translates it with
  `admin:raster:issues:invalid_fields`.
- **State change:** the job ends `failed`; the layer keeps its raster and version.
- **External record:** the job file under the share's jobs folder, and the admin's upload panel.

## Risks / Trade-offs

- [A country with an id-invalid entry can't get new layers until it is repaired] → intended;
  the 400 names the entry so the operations team can fix it.
- [Skipping an entry could hide a layer someone expects] → MB-3 already logs id-invalid entries
  in the admin listing (`admin/layers.py:238-246`), and the public listing logs them once.
- [PUT refused for a broken file name blocks editing the texts] → the layer can't be repaired
  through the API anyway: file names are not editable; the detail says who fixes it.

## Hazards (Step 2b)

| File | Failure mode | Evidence |
|---|---|---|
| `apps/api/app/modules/layers/categories.py` | Changing `index_fields_problem`'s order changes which field MB-3 reports and breaks its tests | MB-3 #165/#176; `tests/modules/admin/test_layers.py:805-951` |
| `apps/api/app/modules/layers/store.py` | `is_layer` is shared by tiles, images and analysis; a lax match (`True == 1`) resolves the wrong layer | `layers/store.py:523-531`; `maps/helpers.py:66-83` |
| `apps/api/app/modules/admin/layers.py` | Partial writes: `_apply_input` writes metadata per language before the index | `admin/layers.py:106-132`; reproduced (considerations case) |
| `apps/api/app/modules/admin/layers.py` | The id rule: ids are never reused | `CLAUDE.md` "Map layers"; `layer-administration` "Ids are never reused" |
| `apps/api/app/modules/admin/rasters.py` | A refusal after the slot is acquired must release it and unlink the staged file | `admin/rasters.py:75-102` (`except BaseException` cleanup) |
| `apps/api/app/modules/admin/ingestion.py` | `activate` runs under the store lock; the share staging file must be unlinked on every exit | `admin/ingestion.py:239-262` |
| `apps/api/app/modules/admin/helpers.py` | `published_ids` decides whether a category can be disabled; counting less must not let a public layer lose its category | `admin/categories.py:159, 248, 310`; id-invalid entries are never public (`layer-storage` spec) |
| `apps/api/app/modules/layer_analysis/router.py` | The analysis contract; a 500 here breaks module 2 for the country | `CLAUDE.md` invariants |
| `apps/web/src/components/page/admin/RasterUploadSection.tsx` | 413/409 keep their own texts | `RasterUploadSection.tsx:73-82` |
| `apps/web/src/locales/{es,en}/admin.json` | Keys must exist in both locales | `src/locales/locales.test.ts` |
| Test files | No known hazard | — |

## File count

15 files (7 API modules, 4 API test files, 2 locales, 1 component and its test). At the cap,
not over it: the web part is two lines plus a key and is what makes the 400 readable.
