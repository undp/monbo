## Context

GC-2 (#118) made the public listing a read-side guard: `LayersRoot._with_categories` tags every
layer with `category_issue` and `layer_issue` (`years_mismatch`), `is_public` adds
`missing_raster`, and only layers without a tag are listed. The admin computes the same tags in
`_to_admin_layer`. The guard covers categories, years, `enabled` and the raster, but not the
types of the other fields, so a bad value reaches a Pydantic model (`BaseMapData`,
`AdminLayer`) or a `Path(...)` call and the whole request fails:

| Field (CO layer 7) | `/maps?country=CO` | `/maps` | `/countries` | `/admin/layers` |
|---|---|---|---|---|
| `version: "abc"` | 500 | 500 | 200 | 500 |
| `pixel_size: "abc"` | 500 | 500 | 200 | 500 |
| `references: "x"` or `[1, 2]` | 500 | 500 | 200 | 500 |
| `raster_filename: 5` | 500 | 500 | 500 | 500 |
| `attributes_filename: 5` / `considerations_filename: 5` | 500 | 500 | 200 | 500 |
| `id: "abc"` | 500 | 500 | 200 | 500 |

(Reproduced with a temporary test on `478defc`, 2026-11-25.) The year that can't be read is
already handled (`test_an_unreadable_year_doesnt_break_the_listing`).

## Goals / Non-Goals

**Goals:**

- No listing answers 500 because of one layer's field types; the rest of the country, and every
  other country, is served unchanged.
- The bad layer is hidden publicly, logged once, and visible in the admin with its reason.
- With a valid index, `GET /maps` and `GET /countries` answer the same bytes as before.

**Non-Goals:**

- Repairing a bad entry from the admin. `PUT /admin/layers/{id}` and the raster upload on a
  layer with a bad `version` or filename may still fail; that is proposed as a follow-up.
- Analysis, tiles and images of a bad layer by id (they resolve hidden layers by id and already
  swallow per-map failures).
- The `is_public` cache for `GET /countries` (MB-7, #173).

## Decisions

1. **One check, next to `years_fit`.** `index_fields_problem(entry) -> str | None` in
   `app/modules/layers/categories.py` returns the first bad field (`"version"`, ...) or None. The
   store and the admin both call it, as they both call `years_fit`. It lives there rather than
   in `store.py` to keep `store.py`'s diff small (MB-7 edits it next).

2. **The rules of creating a layer, checked strictly.** A field is valid when:
   - `id`: an integer, not a boolean;
   - `version`: an integer ≥ 0, not a boolean (0 is a layer created without a raster yet);
   - `pixel_size`: an int or float, not a boolean, finite, `0 < x ≤ 10000` (`LayerInput`);
   - `references`: missing, or a list of strings;
   - `raster_filename`: missing, null or a string;
   - `attributes_filename`, `considerations_filename`: strings.

   *Alternative:* validate with `BaseMapData` itself. Rejected: Pydantic's lax mode accepts
   `version: "3"` and `pixel_size: "30"`, which the listing would then publish while the raster
   upload crashes on `entry["version"] + 1`; and the admin model would need the same check
   anyway. Being strict hides a hand-edited `"3"` that is listed today; the real index has none.
   `references` are checked for type only, not for the `http(s)` rule of `LayerInput`: the
   field doesn't break anything when it is a string list, and older entries were never checked.

3. **New code `invalid_fields`, first in precedence.** `LayerIssue` becomes
   `Literal["invalid_fields", "years_mismatch", "missing_raster"]`. The store sets it whether or
   not the category resolves (it doesn't need the category), before `years_mismatch`; `is_public`
   checks `layer_issue` before the raster, so `has_raster` never sees a non-string filename. The
   web shows `category_issue` first, then `layer_issue`, as today. *Alternative:* one code per
   field. Rejected: the fix is the same (correct the index entry), and the log names the field.

4. **Logged once, like the other hidden layers.** `_log_hidden(layer, "its index field
   '<field>' is invalid")`, keyed as today, whether the layer is enabled or not (a disabled layer
   with a bad entry still breaks the listings today).

5. **The admin shows what it can read.** `AdminLayer.pixel_size: float | None` and
   `AdminLayer.version: int | None` (null when invalid); `references` shows `[]` when not a list
   of strings; `raster_filename` shows `null` and `has_raster` false when not a string; the
   attributes or considerations of a bad filename show `null`. This mirrors `_shown_year`.
   *Alternative:* keep the fields required and send a placeholder (`0`). Rejected: a fake value
   in the admin reads as real data.

6. **A layer with a non-integer `id` is left out of the admin listing**, and logged. Every admin
   route addresses a layer by its integer id, so the admin could neither show nor fix it, and
   `AdminLayer.id` stays an `int`. It is still hidden publicly by the same check.
   *Alternative:* make `AdminLayer.id` nullable. Rejected: the web keys rows and routes by id.

7. **Publishing is refused.** `PATCH /admin/layers/{id}` with `enabled: true` answers 400 for a
   layer with `invalid_fields`, as for one whose years don't fit. Hiding stays allowed.

8. **Web.** `LayerBlocker` gains `invalid_fields`, with its reason and fix in `es`/`en`
   (`status.reasons`, `status.fixes`, `status.fixesPublished`); the fix points to the operations
   team, because the admin can't edit `version` or the filenames. The table shows "—" for a null
   version; the form starts with an empty, required pixel size when it is null.

## Code shape

So the tripwires' mutants in `tasks.md` apply literally, the new code reads:

```python
# app/modules/layers/categories.py
PIXEL_SIZE_MAX = 10_000  # also LayerInput.pixel_size's `le`
LayerIssue = Literal["invalid_fields", "years_mismatch", "missing_raster"]

def _is_int(value: Any) -> bool:
    return isinstance(value, int) and not isinstance(value, bool)

def _is_number(value: Any) -> bool:
    return _is_int(value) or isinstance(value, float)

def index_fields_problem(entry: dict) -> str | None:
    if not _is_int(entry.get("id")):
        return "id"
    version = entry.get("version")
    if not (_is_int(version) and version >= 0):
        return "version"
    pixel_size = entry.get("pixel_size")
    if not (
        _is_number(pixel_size)
        and math.isfinite(pixel_size)
        and 0 < pixel_size <= PIXEL_SIZE_MAX
    ):
        return "pixel_size"
    references = entry.get("references", [])
    if not isinstance(references, list) or not all(
        isinstance(reference, str) for reference in references
    ):
        return "references"
    raster_filename = entry.get("raster_filename")
    if raster_filename is not None and not isinstance(raster_filename, str):
        return "raster_filename"
    for field in ("attributes_filename", "considerations_filename"):
        if not isinstance(entry.get(field), str):
            return field
    return None
```

- `store.py`, `_with_categories`: `fields_problem = index_fields_problem(layer)`; then
  `layer["layer_issue"] = "invalid_fields"` when it is not None, else the current
  `years_mismatch` rule, else None; and `self._log_hidden(layer, f"its index field
  '{fields_problem}' is invalid")` before the category messages.
- `admin/layers.py`: `list_layers` keeps `entry for entry in index if
  index_fields_problem(entry) != "id"` (logging the others); `_to_admin_layer` sets
  `layer_issue = "invalid_fields"` first; `set_layer_enabled` checks, before the raster check
  (which would call `Path(5)`): `fields_problem = index_fields_problem(entry)` and
  `if body.enabled and fields_problem is not None:` → 400 `"Layer {id} can't be published:
  its index field '{field}' is invalid"`.
- Texts: en `"its index entry has fields of an invalid type."` / fix `"Ask the operations team
  to fix its entry in the index."`; es `"su entrada en el índice tiene campos de un tipo
  inválido."` / fix `"Pide al equipo de operaciones que corrija su entrada en el índice."`
  (`fixes` and `fixesPublished` use the same fix).

## Data shape and API contract

- Index on disk: unchanged; nothing is written back.
- `GET /maps`, `GET /countries`: same shape (`BaseMapData` unchanged); status 200 instead of 500.
- `GET /admin/layers`, and the `AdminLayer` returned by `POST`/`PUT`/`PATCH`:
  `pixel_size: number | null`, `version: integer | null`, `layer_issue` adds
  `"invalid_fields"`. Status 200 instead of 500.
- `PATCH /admin/layers/{id}` `{enabled: true}` on such a layer: 400 with the field in `detail`.

## Cross-stack wiring

`AdminLayer` (Pydantic) → `apps/api/openapi.json` → `apps/web/src/api/schema.d.ts` (generated
with `pnpm contracts`) → `interfaces/AdminLayer` → `layerVisibility.ts` (`LayerBlocker`),
`AdminLayersPageContent.tsx` (version cell), `layerFormState.ts` (pixel size). `tsc` fails if
`LayerBlocker` lacks the new `layer_issue` value, which keeps the two in step.

## Hazards (one per touched file)

- `app/modules/layers/store.py`: the tags must not be written back (`read_index` returns
  entries as stored, `_with_categories` tags copies), and MB-7 (#173) edits it next; keep the
  diff to `_with_categories` and `is_public`. Evidence: `store.py:716-717`, #172 "Qué se puede
  hacer en paralelo".
- `app/modules/layers/categories.py`: `LayerIssue` codes are stable and translated by the admin
  (`categories.py:43-44`); add, never rename.
- `app/modules/admin/layers.py`: `_to_admin_layer` already hid one 500 (`_shown_year`, re-review
  3 of #138); every new read of a raw index value must tolerate a hand edit. `has_raster` calls
  `Path(filename)` and raises `TypeError` on a non-string (`store.py:88-90`).
- `app/modules/admin/models.py`: a contract model; `openapi.json` and `schema.d.ts` must change
  in the same commit (`tests/test_openapi.py`, CI's schema check).
- `apps/web/.../layerVisibility.ts`, `layerFormState.ts`, `AdminLayersPageContent.tsx`: no
  known hazard beyond following the generated type.
- `locales/{es,en}/admin.json`: translation parity (`locales.test.ts`) fails on a key in only
  one locale; i18next escapes interpolations (`CategoryForm.test.tsx:154`), not relevant here
  (no interpolation in the new texts).
- Tests in `tests/modules/admin/test_layers.py`: shared fixtures (`categories`, `GFW`) write the
  CO index; a case that writes a raster must use a distinct file name.

## Signal tracing — `layer_issue: "invalid_fields"`

- **Emitter**: `index_fields_problem` via `LayersRoot._with_categories` (public) and
  `_to_admin_layer` (admin).
- **Consumer**: `LayersRoot.is_public` (hides the layer from `GET /maps` and
  `GET /countries`); `set_layer_enabled` (refuses to publish); the web's `layerBlocker`
  (shows the reason, blocks the publish switch).
- **State change**: the layer stops being public; publishing it is refused until the index is
  fixed.
- **External record**: one `logger.error` per layer and field (`_log_hidden`), and the admin's
  notice in the layers list and editor.

## Risks / Trade-offs

- [A hand-edited `version: "3"` or `pixel_size: "30"`, listed today, disappears] → It is logged
  with the field, shown in the admin, and the real index has none (verified byte for byte).
- [`PUT` or a raster upload on a bad entry can still 500] → Out of scope; the admin's fix text
  sends the admin to operations instead. Follow-up proposed on the orchestration.
- [MB-7 edits `store.py`] → This change touches only `_with_categories` and `is_public` there,
  and merges first.

## Migration Plan

None: no stored data changes. Rollback is a revert; the web and API ship together on `dev`.

## Open Questions

None. Closed at Puerta 1 on 2026-11-25 by the user: `layer_issue: "invalid_fields"`; the file
names and `id` are in scope; the checks are strict; editing or uploading a raster to a bad
entry is a follow-up.
