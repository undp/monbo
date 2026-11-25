## Context

- `validate_raster(path, requested_nodata, on_window)` in
  `app/modules/layers/processing.py` runs the structural checks and scans every pixel.
  It is called by the admin ingestion job (`app/modules/admin/ingestion.py`,
  `run_ingestion`) and by the seed command (`app/modules/layers/seed.py`).
- Its errors and warnings are `IngestionError(code, message, **params)` turned into
  `{code, message, params}`. The admin web translates them by code
  (`admin:raster:issues:<code>`) and falls back to the English `message`
  (`RasterUploadSection.tsx`). `JobIssue.code` is a plain `str` in the OpenAPI schema.
- Every message assumes forest loss:

  | Code | Today's message |
  |---|---|
  | `not_integer` | "…use 0 for no loss and 1 for loss" |
  | `nodata_is_loss` | "Nodata cannot be 1 because 1 represents forest loss" |
  | `not_binary` | "The raster must be binary (0 = no loss, 1 = loss)…" |
  | `loss_years` | Any rejected values all in 1980–2100: "They look like loss years: binarize the layer against its baseline year" |
  | `no_loss_pixels` (warning) | "No deforestation pixels (value 1) were found" |

- Since GC-1 (`add-layer-categories`), each layer has a `category_id` that resolves
  against its country's `categories.json` plus the built-in `deforestation`. A category
  has `temporal: bool`: its layers have `baseline` and `compared_against`. The built-in
  `deforestation` is temporal. `resolve_category(category_id, file, by_id)` returns the
  category or a `category_issue` code. The flat layout has no categories file
  (`CategoriesFile()`), so only `deforestation` resolves there.

## Goals / Non-Goals

**Goals:**

- No ingestion message, code or admin text assumes the layer is forest loss.
- The year hint ("binarize against the baseline year") only for layers whose category
  has a baseline (temporal).
- What is accepted and rejected stays exactly the same; only the code and message of a
  rejection or warning change.

**Non-Goals:**

- Admin texts outside the raster section (login subtitle, layer list subtitle, publish
  notice): they still say "deforestation" and belong to GC-5 (admin web) or GC-11
  (neutral wording).
- Requiring years for temporal categories when a layer is saved (GC-2).
- Vector layers (D2), the ratio, the analysis, the tiles.

## Decisions

### 1. `validate_raster` takes a required `temporal` flag

`validate_raster(path, requested_nodata, *, temporal: bool, on_window=None)`. When the
rejected values all look like years and `temporal` is true, the error is `loss_years`;
otherwise it is `not_binary`, with the nodata hint when no nodata is set.

Required, not defaulted: a caller that forgets it would silently get one behavior or
the other, and both callers are in this repo.

*Alternative:* return the offending values and let each caller pick the code. Rejected:
the message is built in one place today and would be split across two callers.

### 2. The caller reads the layer's category before validating

A helper in `app/modules/layers/categories.py`:

```python
def is_temporal(category_id: Any, file: CategoriesFile) -> bool:
    """Whether a layer's category resolves and is temporal."""
```

It resolves with `resolve_category` against `effective_categories(file)`. A category
that doesn't resolve (`unknown_category`, `invalid_category`, `unreadable_categories`)
counts as **not temporal**: we can't tell whether the layer has a baseline, so the
generic `not_binary` is the safe message. A disabled category still resolves, and its
`temporal` applies.

- **Ingestion job:** before the scan, `run_ingestion` reads the country's index entry
  (as stored, so the `category_id` defaults to `deforestation` through the same rule as
  `_with_defaults`) and `country_store.read_categories()`. A missing entry gives
  `temporal=False`; the existing "layer no longer exists" check after validation still
  fails the job, so the outcome doesn't change.
- **Seed:** the source is the flat layout, so it resolves each entry's `category_id`
  against `CategoriesFile()`, like `LayersRoot.layers()` does for the flat root. Today
  every seeded layer is `deforestation`, so seeding behaves as before.

Reading the category before the scan rather than after: the scan of a large raster
takes about a minute, and the category only picks the message, so a category edited
during the scan doesn't matter.

### 3. Generic codes and messages

| Code | New message (English, the API's fallback) |
|---|---|
| `not_integer` | "The raster must have integer values (it has {dtype}); use 0 outside the layer and 1 inside it" |
| `nodata_is_positive` (was `nodata_is_loss`) | "Nodata cannot be 1, because 1 marks the pixels inside the layer" |
| `not_binary` | "The raster must be binary (0 = outside the layer, 1 = inside the layer[, N = nodata]). Other values found: …" |
| `loss_years` (temporal only) | Same legend, plus "They look like years: binarize the layer against its baseline year before uploading." |
| `no_positive_pixels` (was `no_loss_pixels`) | "No pixels inside the layer (value 1) were found" |

- `loss_years` keeps its code: it still exists, now only for temporal categories, and
  the issue (#119) keeps it.
- `no_positive_pixels` is the name proposed in #119; `nodata_is_positive` follows it,
  so "positive" consistently means "value 1, inside the layer".
- The admin texts in `es` and `en` are rewritten for the five codes and for
  `raster.intro` ("0 (outside the layer) and 1 (inside the layer)"). The keys of the two
  old codes are removed.

*Alternative:* keep `nodata_is_loss` and only change its text. Rejected: the code is
read by people too (job files, logs), and the unit is about removing the forest-loss
assumption.

### 4. Old job files are not rewritten

Job files on the share store the code they were created with. A job created by the
previous revision (during a deploy) and still polled shows the API's English message,
because the admin has no key for the old code. Jobs are only polled while an upload
runs, so this lasts minutes. Rolling back the API: the previous web gets the new codes,
has no key for them and shows the English message; nothing breaks.

## Risks / Trade-offs

- [A non-temporal layer is uploaded with a loss-year raster by mistake] → It is still
  rejected (`not_binary`, listing the values); it only loses the "binarize" hint, which
  wouldn't apply to a layer without a baseline.
- [A layer with a broken category gets the generic message] → The upload result is the
  same; the admin sees the category problem on the layer (GC-2/GC-5).
- [GC-2 edits the same locale file (`admin.json`) in parallel] → Different keys; whoever
  merges second rebases. No contract regeneration is involved in this unit.

## Migration Plan

No data migration and no contract change. Deploys with the `feat/layer-manager`
integration PR. Rollback: revert the commit; job files keep whatever code they were
written with (decision 4).

## Open Questions

None. Gate 1 answers (2026-11-17, @BlancaMunizaga): the codes are `no_positive_pixels`
and `nodata_is_positive` (decision 3, `nodata_is_loss` renamed too), and a layer whose
category doesn't resolve is treated as not temporal (decision 2).
