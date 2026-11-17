## Context

- GC-1 (`add-layer-categories`, merged in `feat/layer-manager`) defined the data:
  - `<CC>/categories.json`, a list of `StoredCategory` (snake_case on disk), read by
    `LayerStore.read_categories()` into a `CategoriesFile` (`readable`, valid
    `categories`, `invalid_ids`, `errors`), cached by mtime/size;
  - `effective_categories(file)`: the valid stored categories plus a synthesized
    `deforestation` first, unless the file defines that id (validly or not) or is
    unreadable;
  - `resolve_category()` and the per-layer tags `category_issue` (`unknown_category`,
    `invalid_category`, `unreadable_categories`) and `category_enabled`, which exist only on
    what `LayersRoot` returns, never in `read_index()`;
  - `LayerStore.write_categories(list)`, which refuses any list with a rejected entry;
  - public `LayerCategory` (camelCase) in `app/models/categories.py`, built for reuse here.
- The admin layer routes (`app/modules/admin/layers.py`) act on
  `get_layers_root().country_store(session.country)`, read with `read_index()`, mutate
  entries in place and write with `write_index()` under `store.locked()` (one process-wide
  `RLock`). Their JSON is snake_case (`pixel_size`, `compared_against`): the admin models
  mirror the index, unlike the public camelCase routes.
- `LayerInput` requires `baseline` and `compared_against` and writes them as strings.
  GC-1 made both optional on read and left "required only for temporal categories" to
  this unit, with the rule that writers always write both keys (a release before
  categories reads them with `[]`).
- The admin web form (`components/page/admin/layerFormState.ts`) builds `LayerInput` from
  the generated types, so a new required field breaks `tsc` until the web sends it.

## Goals / Non-Goals

**Goals:**

- A country's admin can create, edit, enable and disable its categories, and choose each
  layer's category, without ever touching another country.
- Field names GC-5 can build on: the category fields are GC-1's, the layer fields are
  the admin's existing snake_case.
- No admin action changes the meaning of a published layer in place, and no write loses
  category data the API doesn't understand.
- The current admin web keeps working until GC-5 replaces the form.

**Non-Goals:**

- The admin UI for categories and the category selector (GC-5).
- Ingestion messages by `temporal` (GC-3).
- Deleting categories, moving categories between countries, or creating countries.
- Any change to the public routes (`GET /maps`, `GET /categories`, `GET /countries`), the
  analysis or the ratio.

## Decisions

### 1. Routes and shapes

All under `/admin/categories`, `require_admin`, scoped to `session.country`, in a new
`app/modules/admin/categories.py` registered like `layers.py`.

| Route | Body | Response | Errors |
|---|---|---|---|
| `GET /admin/categories` | — | `AdminCategories` | 500 index unreadable |
| `POST /admin/categories` | `CategoryCreate` | 201 `AdminCategory` | 409 id taken, 409 file unreadable, 422 |
| `PUT /admin/categories/{id}` | `CategoryInput` | `AdminCategory` | 404, 400 rule, 409 file unreadable, 422 |
| `PATCH /admin/categories/{id}` | `EnabledInput` | `AdminCategory` | 404, 400 rule or rejected entry, 409 file unreadable |

Category JSON is **camelCase**, the same names as the public `LayerCategory`
(`thresholdPercentage`, `resultLabels`), so GC-5 and GC-6 read one shape. The layer models
keep their snake_case.

```text
AdminCategories {
  categories: AdminCategory[]   # effective categories, enabled or not, in file order
  readable: bool                # false: categories.json can't be parsed or read
  errors: string[]              # the file's problems (GC-1's messages, no share paths)
}
AdminCategory = LayerCategory fields, except:
  thresholdPercentage: float | null   # the category's own; null = the global threshold
  + enabled: bool
  + layerCount: int                   # layers of the country with this category_id
  + publishedLayerCount: int          # of those, enabled
CategoryInput  = name, description, icon, color, polarity,
                 thresholdPercentage (nullable), resultLabels, temporal
CategoryCreate = CategoryInput + id
```

- `thresholdPercentage` is **not** resolved here (unlike `GET /categories`): the admin must
  tell "uses the global threshold" from "set to the same value". GC-5 shows the global one
  from `GET /config`.
- Inputs use the admin's `_Strict` base (unknown fields are 422, whitespace stripped) and
  the same limits as `StoredCategory` (shared constants, not copies), so a body that
  passes Pydantic is one the store accepts. Pydantic errors stay 422, like `LayerInput`.
- **The id is chosen by the admin** (`^[a-z][a-z0-9_]{0,49}$`): it is stable, readable in
  `index.json` and logs, and GC-5 can suggest it from the name. A taken id answers 409:
  any valid or rejected id of the file, and `deforestation` (always taken, built in or
  not). *Alternative:* derive it from `name.en`. Rejected: a rename would then either
  change the id (forbidden) or leave a misleading one, and collisions need suffixes.
- New categories start **enabled**, because layers can only be created in an enabled
  category (decision 4). `GET /categories` lists an enabled category with no published
  layer; GC-6 groups by the layers it shows, so an empty category shows nothing.
- `enabled` changes only through `PATCH`, like layers.

### 2. One-entry writes that keep the rest of the file

New `LayerStore.put_category(category: dict, *, first: bool = False)`:

1. under the store lock, read the raw `categories.json` (missing = `[]`); if it can't be
   read or isn't a JSON list, raise `CategoriesUnreadable` (the route answers 409: the
   file must be fixed by operations, never overwritten blind);
2. validate `category` with `StoredCategory` (raises `ValueError`);
3. replace the first raw entry with that id and drop its other copies, or insert it (at
   the start when `first`, else at the end);
4. atomic write, then refresh the cache from the written content (`parse_categories`),
   like `write_categories()`.

Every other entry stays byte-for-byte as stored, including rejected ones and entries
without a usable id. That is what makes repair safe:

- `PUT` on a rejected id (`invalid_ids`) replaces it, and its duplicates, with a valid
  entry, and the layers' `invalid_category` disappears (once its layers are hidden:
  decision 4);
- a file written by a later release (a new icon value, say) survives an admin edit made
  with this release after a rollback.

*Alternative:* write back `CategoriesFile.categories` (only the valid ones) with
`write_categories()`. Rejected: it deletes rejected entries, which loses data and frees
their ids for reuse. *Alternative:* refuse every category write while the file has a
problem. Rejected: the country's admin couldn't repair its own category (D14).

`write_categories()` stays as GC-1 left it.

### 3. The built-in `deforestation` category

It is listed like any other. `PUT` or `PATCH` on it while it is synthesized stores it,
**first** in the file, so `GET /categories` keeps it first. From then on the stored one
wins (GC-1). It follows the same rules as any category: with published layers it can't
be disabled and its polarity can't change. When the stored `deforestation` is rejected it
is not listed (GC-1 doesn't synthesize it then), and `PUT /admin/categories/deforestation`
repairs it.

### 4. Rules that keep a published layer's meaning stable

A published (enabled) layer's results are read through its category's polarity and
years. None of these may change under a published layer; the admin hides the layer
first. Every violation is **400** with a message naming the cause and the layers
involved, checked and written under one `store.locked()` so the check can't race a
concurrent publish.

| Action | Refused when |
|---|---|
| `PATCH` category `enabled: false` | the category has published layers |
| `PUT` category, `polarity` changes | the category has published layers |
| `PUT` category, `temporal` changes | the category has any layer (its years would stop matching) |
| `PUT` on a rejected entry (repair) | the category has published layers (its polarity and years can't be read), or a layer's years don't fit the new `temporal` |
| `PATCH` layer `enabled: true` | its category is disabled or doesn't resolve (`category_issue`), or the layer's years don't fit the category's `temporal` |
| `PUT` layer, `category_id` changes | the layer is published |
| `POST`/`PUT` layer | `category_id` doesn't resolve in the session's country (unknown, rejected or file unreadable) |
| `POST`/`PUT` layer | the category is disabled, unless a `PUT` keeps the layer's current category |
| `POST`/`PUT` layer | temporal category without both years, or non-temporal with any year |

- 400 rather than 409 for these, as the sub-issue specifies: the admin resolves them by
  changing the request or another resource. 409 stays for conflicts with stored state
  the request can't fix (taken id, unreadable file) and the existing raster checks.
- Changing a threshold, the texts, the icon or the color is always allowed: it changes
  how a result is labelled, not what it measures. GC-5 can warn before saving.
- A category of another country is simply unknown in the session's country (400, never a
  hint that it exists elsewhere).
- Publishing is the only way a layer becomes public, so it re-checks the years
  against the category: that also covers a repaired category and hand edits.
- A repair (`PUT` on a rejected entry) keeps the entry's stored `enabled` when it is
  a boolean (`put_category(keep_enabled=True)`): `enabled` changes only through
  `PATCH`.
- Together with GC-1's read-side guard, the admin can no longer produce a published
  layer in a disabled or broken category, or with years that don't fit it. Such a layer can still appear through a hand
  edit of the share; `AdminLayer` shows it (decision 5) and the admin fixes it by moving
  the layer (`PUT`, after hiding it) or repairing the category.

### 5. `LayerInput` and `AdminLayer`

- `LayerInput.category_id: str` (required, slug pattern). `baseline` and
  `compared_against` become `int | None = None`, and the model checks both-or-neither and
  `baseline ≤ compared_against` (422). Whether years are required depends on the
  category, so it is checked in the route (400, decision 4).
- `_apply_input` writes `category_id`, and the years as strings or `null`, always both
  keys.
- `AdminLayer` adds `category_id: str` (as stored, `deforestation` when missing),
  `category_issue: CategoryIssue | null` and `category_enabled: bool`, computed from the
  country's categories with GC-1's `resolve_category()` (one read per request). GC-5
  shows "hidden: category disabled" for `enabled && category_enabled == false &&
  category_issue == null`.

### 6. Web bridge until GC-5

`layerFormState.ts` keeps the layer's `category_id` in the form values
(`deforestation` for a new layer, the only category that exists until GC-5) and sends it
back. Its years stay required in the form, which matches `deforestation` being temporal.
No new UI, no new i18n keys.

## Risks / Trade-offs

- [The admin web form can't create a layer in a non-temporal category before GC-5,
  nor save an existing one: the form requires years and the API refuses them] →
  Expected: GC-5 (undp/monbo#121) adds the selector and hides the years for those
  categories. Until then such layers are edited through the API.
- [The rules add friction: to fix a polarity the admin hides the layers, edits, and
  publishes again] → Preferred over silently inverting published results (orchestration
  risk "polaridad invertida"). The 400 message lists the layers to hide.
- [`put_category` reads the raw file again instead of the cache] → One small file per
  admin write, under the lock that already serializes writes.
- [An admin creates many empty categories that `GET /categories` lists] → Harmless for the
  analysis; GC-6 shows categories through their layers.
- [Two admins of the same country edit the same category] → Last write wins, like layers
  today; each write is atomic and keeps the rest of the file.

## Migration Plan

- **Deploy:** with the integration PR (`feat/layer-manager` → `dev`). No data migration:
  until an admin writes a category, every country has only the built-in `deforestation`
  and every layer resolves to it.
- **Order inside the feature branch:** the API and the web bridge go in the same PR, so
  `feat/layer-manager` never has an admin form that the API rejects.
- **Rollback:** GC-1's procedure in `docs/maps.md` applies unchanged (hide every layer
  whose category is not `deforestation`, and the ones hidden by a disabled or broken
  category, before rolling back). With this change those layers can exist, so the
  procedure is no longer theoretical. A release before categories also requires years
  again when editing a non-temporal layer.

## Open Questions

For gate 1:

1. The rules of decision 4 beyond the sub-issue (polarity and `temporal` locked, a
   published layer can't change category). Recommended as written.
2. Admin-chosen slug ids (decision 1). Recommended over ids derived from the name.
