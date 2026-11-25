## Why

Raster ingestion still assumes every layer is a forest-loss mask: its messages say
`0 = no loss, 1 = loss`, it refuses nodata 1 "because 1 represents forest loss", it
reads any year-like values as "loss years", and it warns "No deforestation pixels" on an
empty mask (`apps/api/app/modules/layers/processing.py:207-284`). Since GC-1 (#132),
a layer belongs to a country category, and a protected-areas or agricultural-frontier
admin who uploads a mask gets messages about deforestation, or advice to "binarize
against the baseline year" for a layer that has no baseline. Part of the "Gestor de
capas" orchestration (undp/monbo#116), unit GC-3 (undp/monbo#119).

## What Changes

- **Generic wording for the binary rule.** Every ingestion message describes a mask:
  `0 = outside the layer, 1 = inside the layer`. That covers `not_binary`,
  `not_integer` and the nodata rule.
- **Year detection only for temporal categories.** Offending values that all fall in
  1980–2100 are reported as `loss_years` only when the layer's category is `temporal`
  (the built-in `deforestation` is). For any other category, or a layer whose category
  doesn't resolve, the error is the generic `not_binary`.
- **Generic codes.** The warning `no_loss_pixels` becomes `no_positive_pixels` ("No
  pixels inside the layer (value 1) were found"), and the error `nodata_is_loss` becomes
  `nodata_is_positive`. Codes are a plain `str` in `JobIssue`, so the OpenAPI contract
  doesn't change.
- **Admin texts** for those codes, and the raster section's intro, rewritten in `es` and
  `en`. The keys of the old codes are removed.
- **Seeding** applies the same rule: each seeded layer's category decides whether years
  are detected.
- **Docs:** `docs/maps.md` is retitled "Map layers", and its raster requirements stop
  describing every layer as forest loss.
- No change to what is accepted or rejected, to the ratio, to the analysis or to the
  tiles: only which code and message a rejected raster gets.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `raster-ingestion`: the binary validation describes the layer generically, detects
  year values only for temporal categories, and the empty-raster warning and the nodata
  rule get generic codes and messages.

## Impact

- **API:**
  - `app/modules/layers/processing.py`: generic messages and codes, and a required
    `temporal` argument for `validate_raster`.
  - `app/modules/layers/store.py` (or `categories.py`): one helper that tells whether a
    layer's category is temporal.
  - `app/modules/admin/ingestion.py` and `app/modules/layers/seed.py`: pass it.
- **Web:** `apps/web/src/locales/{es,en}/admin.json` (`raster.intro` and
  `raster.issues`). No code changes: the admin translates issues by code.
- **Contracts:** none (`JobIssue.code` is `str`). `openapi.json` and `schema.d.ts` stay
  as they are.
- **Docs:** `docs/maps.md`.
- **Tests:** ingestion tests for a temporal and a non-temporal layer, plus the renamed
  codes. The regression suite and `tests/test_numeric_baseline.py` are untouched and
  must pass without regeneration.
