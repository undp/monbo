## Why

One layer whose index entry holds a value of the wrong type (a hand edit of the share) takes
down a whole listing. Reproduced on `dev` (`478defc`) on 2026-11-25 with CO's layer 7:
`version: "abc"`, `pixel_size: "abc"`, `references: "x"` or `references: [1, 2]` make
`GET /maps?country=CO`, `GET /maps` (every country, so EC and CR too) and `GET /admin/layers`
answer 500. A non-string `raster_filename`, `attributes_filename` or `considerations_filename`,
or a non-integer `id`, does the same, and a non-string `raster_filename` also breaks
`GET /countries`. A whole country left without analysis is worse than one hidden layer
(undp/monbo#165, unit MB-3 of #172).

## What Changes

- The storage module checks the type of every index field the listings read (`id`, `version`,
  `pixel_size`, `references`, `raster_filename`, `attributes_filename`,
  `considerations_filename`) by the rules of creating a layer. A layer that fails gets
  `layer_issue: "invalid_fields"`: it is hidden from `GET /maps` and `GET /countries`, logged
  once as an error naming the country, the layer and the field, and still resolves by id like
  any hidden layer. The rest of its country is served as before.
- `GET /admin/layers` lists such a layer with `layer_issue: "invalid_fields"` instead of
  answering 500. A field it can't read is shown empty: `pixel_size` and `version` become
  nullable, `references` shows `[]`, `raster_filename` shows `null`, the metadata of a bad
  filename shows `null`. A layer whose `id` isn't an integer can't be addressed by any admin
  route, so it is left out of the admin listing and logged.
- `PATCH /admin/layers/{id}` refuses to publish a layer with `invalid_fields` (400), like a
  layer whose years don't fit.
- The admin UI names the new reason and its fix ("ask the operations team to fix its index
  entry") in `es` and `en`; the layers table shows "—" for a null version and the form starts
  with an empty pixel size when it is null.
- **Contract change**: `LayerIssue` gains `invalid_fields`; `AdminLayer.pixel_size` and
  `AdminLayer.version` become nullable. `openapi.json` and `schema.d.ts` are regenerated in the
  same commit. `GET /maps` (`BaseMapData`) does not change.

## Non-goals

- Repairing a bad entry from the admin: `PUT /admin/layers/{id}` and the raster upload on a
  layer with an invalid `version` or file name may still fail (follow-up on #172).
- Analysis, tiles and images of a bad layer by id.
- The year that can't be read (already handled) and the `is_public` cache of
  `GET /countries` (MB-7, #173).
- Checking `references` against the `http(s)` rule of `LayerInput`: only their type.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `layer-storage`: the public listing also hides layers whose index fields have an invalid
  type, and tags them `layer_issue: invalid_fields`.
- `layer-administration`: the admin listing shows those layers with the new issue (and
  nullable `pixel_size`/`version`), publishing them is refused, and the UI explains the reason.

## Impact

- API: `app/modules/layers/categories.py` (`LayerIssue`, the field check),
  `app/modules/layers/store.py` (`_with_categories`, `is_public`), `app/modules/admin/layers.py`,
  `app/modules/admin/models.py`; tests in `tests/modules/admin/test_layers.py` and
  `tests/modules/layers/`.
- Contract: `apps/api/openapi.json`, `apps/web/src/api/schema.d.ts`.
- Web: `components/page/admin/layerVisibility.ts`, `layerFormState.ts`,
  `AdminLayersPageContent.tsx`, `locales/{es,en}/admin.json`, and their tests.
- MB-7 (#173) edits `store.py` afterwards; this change merges first.
- No change to the analysis math, the rasters or `GET /maps` for a valid index: with the
  real index, `GET /maps` (no filter, CO, CR, EC) and `GET /countries` answer the same bytes.
