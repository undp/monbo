## Why

MB-3 (#165, #176) made the public listings and `GET /admin/layers` tolerate an index entry
with fields of an invalid type, but every route that resolves a layer by id or writes one
still answers 500 when a country's `index.json` carries such an entry (issue #184). `CLAUDE.md`
asks for an explicit 4xx, never a 500, and one hand-edited entry must not take down the
analysis and tiles of the rest of the country.

Reproduced against `dev` (`9f46d6c`), all 500 today:

- `POST /admin/layers` when an entry's `id` is `"abc"`, `[7]` or missing
  (`apps/api/app/modules/admin/layers.py:292`), or when another entry's
  `attributes_filename` is not a string (`admin/layers.py:258`).
- `PUT`/`PATCH /admin/layers/{id}` when an entry without `id` comes before the layer
  (`admin/layers.py:48`).
- `PUT /admin/layers/{id}` on a layer whose `attributes_filename` or `considerations_filename`
  is not a string (`layers/store.py:91`); in the second case the `en` attributes file is
  already written when it fails. Also when its `pixel_size` is missing and the body changes it
  (`admin/layers.py:323`).
- `PUT /admin/layers/{id}/raster` when an entry without `id` comes before the layer
  (`admin/rasters.py:29`); with an invalid `version` the upload is accepted (202) and the job
  fails as `unexpected` after the whole conversion (`admin/ingestion.py:249`).
- `GET /admin/categories` when a published entry has no `id` (`admin/helpers.py:63`).
- `POST /layer_analysis/analyze` and the tiles of a country with an entry without `id`
  (`layer_analysis/router.py:43`, `layers/store.py:527`), and the analysis of a layer whose
  `version` is invalid (the response model requires an integer).

## What Changes

The rule the user approved (hybrid):

- **Lookups by id skip** entries whose `id` is not an integer, as the listings already do
  (MB-3). A boolean never counts as an id. This covers analysis, tiles, images, `PUT`,
  `PATCH`, the raster upload, the ingestion job, and the admin category counters.
- **Creating a layer answers 400** naming the entry (its position and value) while any entry
  of the country has an invalid `id`, and writes nothing: skipping it could reuse an id once
  the entry is repaired (`"3"` → `3`). Another entry's non-string file name no longer breaks
  the choice of the new layer's metadata names.
- **An operation on a layer that needs one of its invalid fields answers 400** naming the
  layer and the field, before writing anything:
  - `PUT /admin/layers/{id}`: `attributes_filename`, `considerations_filename`,
    `raster_filename`. A missing or invalid `pixel_size` or `references` no longer fails:
    `PUT` overwrites them, so it stays the way to repair them.
  - `PUT /admin/layers/{id}/raster`: `version`, `pixel_size`, `raster_filename`, checked
    before the body is staged. The job checks them again before converting and under the
    store lock before activating, and fails with the new code `invalid_fields` instead of
    `unexpected`.
  - `POST /layer_analysis/analyze` on a layer whose `version` is invalid (the same rule,
    applied to the one public route that needs the field).
- The admin UI shows the API's reason for a 400 on the raster upload, and translates the job
  code `invalid_fields`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `layer-storage`: lookups by id skip entries without a valid id; analysis refuses a layer
  whose `version` is invalid.
- `layer-administration`: admin writes and lookups with invalid index entries (create, edit,
  publish, category counters).
- `raster-ingestion`: the upload and the job refuse a layer whose `version`, `pixel_size` or
  `raster_filename` is invalid.

## Non-goals

- Repairing the index automatically, or a UI to edit `id`, `version` or file names: the
  operations team fixes them in `index.json`, as MB-3 established.
- The legacy CLI `app/modules/layers/migrate_countries.py` and `layers/seed.py`, which read
  `entry["id"]` and other fields directly: they run by hand over a known index.
- Changing which entries the public and admin listings show (MB-3 behaviour stays as is).
- No API contract change: the job error `code` is already a free string
  (`app/modules/admin/models.py:282`), and no response model changes.

## Impact

- API: `app/modules/layers/categories.py`, `layers/store.py`, `admin/helpers.py`,
  `admin/layers.py`, `admin/rasters.py`, `admin/ingestion.py`, `layer_analysis/router.py`,
  and their tests.
- Web: `components/page/admin/RasterUploadSection.tsx` and its test, `locales/{es,en}/admin.json`.
- No `openapi.json` or `schema.d.ts` change.
