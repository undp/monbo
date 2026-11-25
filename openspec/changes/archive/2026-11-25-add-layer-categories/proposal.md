## Why

Monbo only knows one kind of layer: a binary raster where `1` is forest loss. Countries now
need to analyze farms against other layers too (protected areas, agricultural frontier),
each with its own meaning, threshold and wording. The API has no concept of a layer's kind:
there is no category, type or polarity anywhere in `apps/api/app` (searched 2026-11-16).
This change adds that concept to the storage and the public contract. The admin CRUD
(GC-2), the ingestion messages (GC-3) and the web screens (GC-5 to GC-8) build on it, so
its field names have to be stable. Part of the "Gestor de capas" orchestration
(undp/monbo#116), unit GC-1 (undp/monbo#117).

## What Changes

- **A per-country category file**, `<CC>/categories.json`, next to the country's
  `index.json`, read and written through the storage module with the same lock, cache and
  atomic write. Each category has a stable slug `id`, `name` and `description` in `es` and
  `en`, an `icon` from a fixed catalog, a `color`, a `polarity` (`avoid` or `required`),
  an optional `threshold_percentage` (0–100, falling back to the global threshold),
  `result_labels` (`ok` and `flagged`, in `es` and `en`), `temporal` and `enabled`.
- **A built-in `deforestation` category.** It is synthesized on read when the country's
  file doesn't define it, so no share needs a migration and the legacy flat layout works
  unchanged. It is `avoid`, `temporal`, with no threshold of its own.
- **Every layer gets a `category_id`.** A layer without one belongs to `deforestation`.
- **A broken category never takes a country down.** A layer whose category can't be
  resolved (an id the country doesn't have, a stored category that fails validation, or
  a `categories.json` that can't be parsed) is left out of the public listings and
  tagged by the storage module with a `category_issue` code, so the country's admin can
  see and fix it (exposed by GC-2's admin API, shown by GC-5's UI). The rest of the
  country keeps working. The layer is never listed under a guessed category.
- **`baseline` and `compared_against` become optional in the stored index** (missing or
  `null`), for layers of categories that are not `temporal`. Requiring them for temporal
  categories at write time is GC-2's admin input.
- **`GET /maps`** adds `categoryId` (always sent) to every layer, and stops listing a
  layer whose category is disabled or has a `category_issue`. `GET /countries` counts
  only the layers `GET /maps` would list.
- **New public `GET /categories?country=CC`**: the country's enabled categories, with
  both languages in each text and the threshold already resolved (category threshold or
  the global one). Unknown or disabled country: an empty list.
- **Contracts regenerated**: `apps/api/openapi.json` and `apps/web/src/api/schema.d.ts`.
- **Rollback documented and checked**: what the previous release does with a
  `category_id` and a `categories.json` on the share (it ignores both), and the one case
  that needs action before rolling back (layers of non-deforestation categories must be
  disabled first, or the previous web shows them as deforestation).
- No change to the ratio, the analysis, the tiles or `GET /config`.

## Capabilities

### New Capabilities

- `layer-categories`: what a category is, where it is stored, its fields and their
  validation, the built-in `deforestation` category, how a layer refers to its category,
  and the public `GET /categories` endpoint.

### Modified Capabilities

- `layer-storage`: index entries gain the optional `category_id`; `baseline` and
  `compared_against` may be missing or `null`; the country folder holds
  `categories.json`, written atomically like the index; `GET /maps` returns `categoryId`
  and hides layers of disabled or unresolved categories.
- `country-registry`: `GET /countries` lists a country only when it has at least one
  layer that `GET /maps` lists (today: at least one enabled layer).

## Impact

- **API:**
  - `app/modules/layers/store.py`: read, cache and write `categories.json`; resolve each
    layer's category and tag unresolved ones with `category_issue`.
  - A new `app/modules/layers/categories.py`: the stored category model, its validation,
    the icon catalog and the built-in `deforestation` category.
  - `app/models/categories.py`: the public `LayerCategory` response model, shared with
    GC-2.
  - `app/models/maps.py` and `app/modules/maps/router.py`: `categoryId`, tolerant reads of
    the years.
  - `app/modules/maps/categories.py`: `GET /categories`, registered in the maps module.
- **Contracts:** `openapi.json` and `schema.d.ts` regenerated in the same commit. No web
  code changes: the web consumers are GC-4 to GC-8.
- **Docs:** `docs/maps.md` (category file, `category_id`, optional years, rollback).
- **Data:** none migrated. The Git-tracked `app/maps` and the Azure share keep working
  as they are; all six existing layers fall into `deforestation`.
- **Tests:** store and endpoint tests. The regression suite and
  `tests/test_numeric_baseline.py` must pass without regeneration.
