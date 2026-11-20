## Context

- Layers are stored under `MAPS_ROOT`, in the per-country layout (`countries.json` plus one
  folder per country with its `index.json`) or the legacy flat one (the Git-tracked
  `app/maps`). `app/modules/layers/store.py` is the single owner of those files: one
  process-wide lock, an mtime/size cache per index and atomic writes that survive the
  Azure Files rename quirks.
- An index entry has `id`, `raster_filename`, `attributes_filename`,
  `considerations_filename`, `pixel_size`, `baseline`, `compared_against`, `references`
  (and `available_countries_codes` in the flat layout). `enabled` and `version` are
  defaulted on read (`_with_defaults`).
- `GET /maps` maps each entry field by field into `BaseMapData`
  (`app/modules/maps/router.py`). It reads `map["baseline"]` and
  `map["compared_against"]` with `[]`, so a missing key is a 500 today.
- The admin rewrites entries in place (`entry.update(...)` in `admin/layers.py`,
  `entry["raster_filename"] = ...` in `admin/ingestion.py`), so it keeps keys it doesn't
  know.
- The single threshold is `DEFORESTATION_THRESHOLD_PERCENTAGE`, served by `GET /config`.
  It is not renamed (orchestration decision D12).
- Consumers of this contract: GC-2 (admin CRUD of categories, `category_id` in
  `LayerInput`), GC-3 (ingestion messages by `temporal`), GC-4 (one classification
  function taking `{ polarity, thresholdPercentage }`), GC-6/GC-7 (results grouped by
  category, labels), GC-8 (methodology).

## Goals / Non-Goals

**Goals:**

- A category model with field names that GC-2 to GC-8 can rely on without renames.
- Zero migration: today's share and `app/maps` keep working, every existing layer is a
  `deforestation` layer, and analysis results are byte-identical.
- A layer is never listed under a category that doesn't exist or doesn't validate, and a
  broken category never takes the rest of its country down.
- The previous release keeps working if the API is rolled back after categories exist.

**Non-Goals:**

- Admin routes to create or edit categories, and `category_id` in `LayerInput` (GC-2).
- Requiring years only for temporal categories at write time (GC-2).
- Ingestion messages and `loss_years` by category (GC-3).
- Any web code, client or i18n key (GC-4 to GC-8). Only the generated `schema.d.ts`
  changes on the web side.
- Changing the ratio, the tiles' color or `GET /config`.

## Decisions

### 1. One `categories.json` per country folder, a JSON list

`<CC>/categories.json` sits next to `<CC>/index.json` and is a list, like the index. It
is read through a new `LayerStore.read_categories()` with the same lock and mtime/size
cache as `read_index()`, and written with `LayerStore.write_categories()` through the
existing `_atomic_write` (GC-2 is the first writer). A missing file means "no stored
categories", not an error.

*Alternative:* a section inside `index.json`. Rejected: the index is a list that older
releases parse as a list, and mixing both would make every index write rewrite the
categories.

### 2. Stored shape (snake_case on disk)

```json
{
  "id": "protected_areas",
  "name": {"es": "Áreas protegidas", "en": "Protected areas"},
  "description": {"es": "…", "en": "…"},
  "icon": "shield",
  "color": "#1565c0",
  "polarity": "avoid",
  "threshold_percentage": 0,
  "result_labels": {
    "ok": {"es": "Fuera de áreas protegidas", "en": "Outside protected areas"},
    "flagged": {"es": "En área protegida", "en": "In a protected area"}
  },
  "temporal": false,
  "enabled": true
}
```

Validated by a Pydantic model, `StoredCategory`, in `app/modules/layers/categories.py`:

| Field | Rule |
|---|---|
| `id` | `^[a-z][a-z0-9_]{0,49}$`, unique in the file. Never reused (GC-2 enforces: no delete). |
| `name` | `{es, en}`, each 1–100 characters |
| `description` | `{es, en}`, each 0–1000 characters |
| `icon` | One of the catalog: `forest`, `shield`, `agriculture`, `water`, `mountain`, `wetland`, `fire`, `layers` |
| `color` | `^#[0-9a-fA-F]{6}$` |
| `polarity` | `avoid` (coinciding with the layer is a finding) or `required` (not coinciding is) |
| `threshold_percentage` | `null` or a number in 0–100 inclusive. `null` or missing: the global threshold |
| `result_labels` | `{ok: {es, en}, flagged: {es, en}}`, each 1–60 characters |
| `temporal` | boolean: the category's layers have `baseline` and `compared_against` |
| `enabled` | boolean, default `true` |

The icon catalog is semantic, not tied to a web icon library: GC-5 maps each value to an
MUI icon. Adding a value later is backward compatible; removing one is not.

Validation is per category, so one bad entry doesn't take the others down.
`read_categories()` returns a `CategoriesFile` with:

- `readable`: `false` when the file exists but is not JSON or not a list;
- `categories`: the valid entries, in file order;
- `invalid_ids`: ids of entries that fail validation, and ids that appear more than once
  (all copies: which one is meant is ambiguous, and polarity must never be guessed);
- `errors`: one message per problem (entry position, id when there is one, reason).

Each problem is logged once per file version (the result is cached with the file's
mtime/size). An entry without a usable `id` can't be referenced, so it only produces an
error. An I/O error while reading the file is different: it may be transient on the SMB
share, so it is never cached (the next read retries), and the same error is logged once
until a read succeeds. `write_categories()` refreshes the cache like `write_index()`, so a
rewrite in the same mtime tick with the same size is never read back stale.

### 3. The built-in `deforestation` category

`effective_categories(file)` returns the valid stored categories plus a synthesized
`deforestation` (first in the list) when the file is missing, or is readable and has no
entry with that id. A stored `deforestation` wins entirely, so GC-2 can edit its texts or
threshold by writing it. When the stored `deforestation` is invalid, or the file is
unreadable, the built-in one is **not** synthesized: its layers would otherwise be
classified with the global threshold instead of the one the country set, silently.

| Field | Value |
|---|---|
| `id` | `deforestation` |
| `name` | es "Deforestación", en "Deforestation" |
| `description` | es "Pérdida de bosque posterior al año de línea base de la capa.", en "Forest loss after the layer's baseline year." |
| `icon` | `forest` |
| `color` | `#c62828` (the red the tiles are drawn in) |
| `polarity` | `avoid` |
| `threshold_percentage` | `null` (the global threshold, today's behavior) |
| `result_labels` | ok: es "Libre de deforestación", en "Deforestation-free"; flagged: es "Con deforestación", en "With deforestation" |
| `temporal` | `true` |
| `enabled` | `true` |

The id is the constant `DEFAULT_CATEGORY_ID`. In the flat layout there is no category
file: the effective categories are only the built-in one.

### 4. Each layer resolves its category on read; an unresolved one is hidden and tagged

Decided at gate 1 (2026-11-16, @BlancaMunizaga): a layer with a broken category must not
take its country down, and the country's admin must see the problem to fix it.

`_with_defaults` adds `category_id: "deforestation"` when the entry has none. Then
`LayersRoot.layers()` and `LayersRoot.country_layers()` read the country's categories
once and tag every entry with:

- `category_issue`: `None` when the category resolves, or a stable code:
  - `unknown_category`: no category with that id (the file is readable and doesn't
    define it, and it isn't the built-in one);
  - `invalid_category`: the id is in `invalid_ids` (fails validation or is duplicated);
  - `unreadable_categories`: the file can't be parsed, so no category resolves;
- `category_enabled`: the resolved category's `enabled`, `False` when there is an issue.

Each issue is logged as an error naming the country, the layer and the category. The
tags exist only on what `LayersRoot` returns; `LayerStore.read_index()`, which the admin
reads before writing, returns the entries as stored, so the tags are never written back.

Effects:

- `GET /maps` and `GET /countries` skip the layer (decision 7), so it can't be picked
  for a new analysis and is never shown under a guessed category.
- Analysis, tiles and images still resolve it by id, like a disabled layer. That is
  safe because `value` is the coverage fraction, independent of the category (D4): the
  polarity is applied by the web from `GET /categories`, which doesn't list the broken
  category.
- GC-2 exposes `category_issue` in `AdminLayer` (and `errors` of the category file for
  its categories view); GC-5 shows it. GC-1 only makes the state readable from the store.

*Alternative considered:* make the country's index unreadable (500), like an invalid
`index.json`. Rejected at gate 1: the only fix would be by hand, and one layer would take
every layer of its country down.

In the flat layout there is no category file: only `deforestation` resolves, and any
other `category_id` is `unknown_category`.

### 5. Years are optional on read, and always written as keys

`baseline` and `compared_against` may be missing or `null` in the index. `GET /maps`
reads them with `.get()` and returns `null`, as `BaseMapData` already allows. Writers
(GC-2) SHALL always write both keys, `null` for a non-temporal layer, because the
previous release's `GET /maps` reads them with `[]` (see Migration Plan).

### 6. Public contract (camelCase)

`GET /maps` adds `categoryId: str` (required) to `BaseMapData`, and leaves out a layer
whose category is disabled or has a `category_issue` (decision 7).

New `GET /categories?country=CC`, in the maps module next to `GET /countries`
(`app/modules/maps/categories.py`), `response_model=list[LayerCategory]`:

```json
{
  "id": "deforestation",
  "name": {"es": "Deforestación", "en": "Deforestation"},
  "description": {"es": "…", "en": "…"},
  "icon": "forest",
  "color": "#c62828",
  "polarity": "avoid",
  "thresholdPercentage": 10.0,
  "resultLabels": {
    "ok": {"es": "Libre de deforestación", "en": "Deforestation-free"},
    "flagged": {"es": "Con deforestación", "en": "With deforestation"}
  },
  "temporal": true
}
```

- `LayerCategory`, `LocalizedText` and `ResultLabels` live in `app/models/categories.py`
  (shared with GC-2's admin responses), with `json_schema_serialization_defaults_required`.
  `icon` and `polarity` are string enums in the schema.
- **Both languages in every text** rather than a `language` parameter like `GET /maps`:
  the list is small, the admin (GC-2/GC-5) needs both anyway, and the report can't
  render a category name in the wrong language by fetching the wrong variant.
- **`thresholdPercentage` is resolved** (the category's own, or
  `DEFORESTATION_THRESHOLD_PERCENTAGE`), never `null`. GC-4's rule is
  `{ polarity, thresholdPercentage }`, so the web never reimplements the fallback.
- No `enabled` field: only enabled categories are returned.
- `country` is required (422 without it, and on a malformed code). An unknown or
  disabled country returns `[]`, like `GET /maps`. In the flat layout, a country that
  some enabled layer lists gets the built-in category; any other gets `[]`.
- Only valid categories are listed: an invalid or unreadable category file never makes
  this endpoint fail. A country whose `index.json` can't be read answers 500, like
  `GET /maps`.

### 7. Only layers with a usable category are public

`GET /maps` lists a layer only when the layer is enabled, its category resolves
(`category_issue` is `None`) and that category is enabled. `GET /countries` applies the
same rule (`LayersRoot.public_countries()`), so a country is never offered with nothing
to pick. A hidden layer still resolves by id for analysis, tiles and images, like a
disabled layer. This way the web never gets a layer whose category is missing from
`GET /categories`. GC-2 additionally refuses to disable a category that has published
layers; this is the read-side guard.

Decided at gate 1 (2026-11-16, @BlancaMunizaga).

## Risks / Trade-offs

- [A hand edit breaks a country's categories file] → Only the layers of the affected
  categories disappear from the public app (all of the country's layers when the file
  can't be parsed); the rest keeps working, the error log names the file, and the layers
  carry `category_issue` for the admin (GC-2/GC-5). The admin validates before writing,
  and `categories.json` is in the share's daily snapshot.
- [A broken category hides layers that a farmer was about to use] → Preferred over
  showing them under a guessed category or threshold. A browser that already holds an
  analysis with that layer keeps its `value`, but GC-6 can't classify it without the
  category, so it must show it as unknown rather than guess.
- [The read path now opens a second small file per country] → It shares the mtime/size
  cache, so a steady-state request only `stat`s it, like the index.
- [The icon catalog is too small for a country's needs] → Adding values is backward
  compatible; GC-5 maps unknown future values to a generic icon.
- [Field names lock in before the UI exists] → They follow the orchestration glossary
  (polarity, threshold, result labels) that GC-4/GC-6 were written against.

## Migration Plan

**Deploy (train 2):** no data migration. Every existing layer has no `category_id` and no
`categories.json` exists, so `GET /categories?country=CO` returns only the built-in
`deforestation` and `GET /maps?country=CO` returns `categoryId: "deforestation"` on every
layer. Analysis inputs and outputs are unchanged (regression and numeric baseline pass
without regeneration).

**Rollback to the previous release.** What the previous API does with data written after
this change, checked on 2026-11-16 by running the `origin/dev` API at `2903805`
(pre-change) against a scratch per-country root with `category_id` on both CO layers
(`deforestation` and `protected_areas`), a `categories.json` and `null` years: `GET /maps`
200 (both layers, no `categoryId`), `GET /countries` 200, a tile of the
`protected_areas` layer 200, an analysis of both layers 200, `GET /admin/layers` 200
(`baseline: null`), `PATCH /admin/layers/1` 200 keeping `category_id` on disk; with the
`baseline` key removed, `GET /maps` 500.

| Data | Previous release |
|---|---|
| `category_id` in an entry | Ignored: `GET /maps` and `AdminLayer` map fields one by one. Kept by admin edits and raster uploads, which update entries in place. |
| `<CC>/categories.json` | Never read. |
| `baseline: null` / `compared_against: null` | `GET /maps` returns `null`. Admin edit requires years again. |
| `baseline` key missing | `GET /maps` answers 500 (`map["baseline"]`). Avoided by decision 5: writers always write the keys. |
| A layer of a `required` category (e.g. agricultural frontier) | **Shown and classified as deforestation**: the previous web compares `value` to the threshold, so the result is inverted. |

So, before rolling back past train 2: disable every layer whose category is not
`deforestation`; note that a country's own `deforestation` threshold falls back to the
global one; and disable the layers that are hidden today by a disabled or broken
category, because the previous release publishes them again. Then roll back. The procedure goes into
`docs/maps.md`. Until GC-2 ships no such layer can exist, so rolling back GC-1 alone needs
nothing.

## Open Questions

None. Gate 1 answers (2026-11-16, @BlancaMunizaga): unresolved categories hide and tag
the layer instead of failing the country (decision 4); texts carry both languages
(decision 6); layers of disabled categories are not public (decision 7); the icon catalog
and the built-in category's values are approved (decisions 2 and 3).
