# Map layers

A layer is a binary GeoTIFF (`1` = inside the layer, `0` = outside it) plus its
metadata in English and Spanish. What "inside" means depends on the layer's
[category](#categories): for a `deforestation` layer, forest lost after the baseline
year; for a protected-areas layer, the protected areas. The API analyzes farms
against it, serves its map tiles and draws it into the report images.

Every layer belongs to one country and to one of that country's
[categories](#categories) (all of today's layers are in `deforestation`), and each
country has its own admin. Layers are managed with the **layers admin** (`/admin` in
the frontend). Editing the files by hand is only for local work.

## Where layers live

The API reads layers from `MAPS_ROOT`:

| Environment | `MAPS_ROOT` | What it is |
|---|---|---|
| Azure | `/mnt/maps` | The per-country layout on the `maps` Azure Files share, with backups ([suggested_deployment.md](suggested_deployment.md)) |
| Local, default | `app/maps` | The layers tracked in Git (Git LFS), in the flat layout |
| Local, trying the admin | `.local-maps` | `app/maps` migrated to the per-country layout, ignored by Git ([onboarding.md](onboarding.md#48-trying-the-layers-admin-locally)) |

The layers in Git are the source the share was seeded from. Admin changes only
reach the share: they are never committed. The API image doesn't contain them: a
container needs the share or another layers folder mounted at `MAPS_ROOT`, and the
API refuses to start when that root holds neither layout.

### Per-country layout

What the admin needs. Inside `MAPS_ROOT`:

```
countries.json                                   # the country registry
CO/index.json                                    # Colombia's layers
CO/categories.json                               # Colombia's layer categories (optional)
CO/layers/rasters/<stem>-v<version>.tif          # one Cloud Optimized GeoTIFF per raster version
CO/metadata/attributes/<en|es>/<name>.json       # name, alias, source... per language
CO/metadata/considerations/<en|es>/<name>.md     # Markdown notes per language (optional)
EC/...  CR/...                                   # the same for every other country
.jobs/                                           # admin ingestion jobs (share only)
usage/                                           # usage events, not layers (see below)
```

`countries.json` lists each country's ISO 3166-1 alpha-2 `code`, the SHA-256 of its
admin passkey (`passkey_hash`, never the passkey) and whether it is `enabled`. It is
managed with the countries command (see [Countries](#countries)), never by hand.

#### Usage events

In Azure, `usage/` (the API's `USAGE_DIR`) holds the usage figures the admin's Usage
page shows. Countries come from `countries.json`, so the folder is never read as one.

```
usage/<YYYY-MM>/<replica>-<pid>.jsonl   # one JSON line per event, one file per API process
usage/rollups/<YYYY-MM>.json            # a closed month, summarized: a cache
```

- **What an event holds:** the time, the step (upload, validation, analysis, report
  requested or downloaded), its outcome, an anonymous browser-tab session ID, the
  country and counts. Never farm data: no IDs, producers, coordinates, file names or
  IP addresses.
- **Backup:** it is on the share, so it is in the daily snapshot. The API also writes
  every event to stdout, so Log Analytics keeps a copy for its retention (30 days by
  default).
- **Deleting old months:** delete their `usage/<YYYY-MM>/` folders and their
  `usage/rollups/<YYYY-MM>.json`. Their figures disappear from the Usage page.
- **The rollups** are rebuilt from the events whenever they are missing or out of
  date, so `usage/rollups/` can always be deleted.

### Flat layout (legacy)

The Git-tracked `app/maps` keeps the layout from before countries had their own
folders: one `index.json` at the root, each layer listing its countries in
`available_countries_codes`. The API still serves it, read-only: the public app works
and the admin stays off.

## The index

Each country's `index.json` is a list with one entry per layer:

```json
{
  "id": 0,
  "raster_filename": "gfw-v1.tif",
  "attributes_filename": "gfw.json",
  "considerations_filename": "gfw.md",
  "enabled": true,
  "version": 1,
  "pixel_size": 30,
  "baseline": "2020",
  "compared_against": "2023",
  "references": ["https://glad.earthengine.app/view/global-forest-change"],
  "category_id": "deforestation"
}
```

- **id**: Numbered within the country, from 0, and never reused. New layers get the
  country's highest id plus one. A layer is identified by its country and its id:
  analyses, tiles and report images send both (in the flat layout, ids are unique on
  their own).
- **raster_filename**: File in `layers/rasters/`. `null` for a new layer that has no
  raster yet.
- **attributes_filename** / **considerations_filename**: Files in the metadata
  folders, the same name for both languages. New layers use `layer-<id>.json` and
  `layer-<id>.md`.
- **enabled**: Whether the layer is published. `GET /maps` only lists enabled
  layers. A disabled layer still resolves by id, so analyses and tiles that
  reference it keep working. Missing means `true`.
- **version**: Goes up by one with every successful raster upload. The frontend adds
  it to tile URLs (`?v=<version>`), so a new raster isn't hidden behind cached tiles.
  If a version or calculation field changes during an open analysis, the browser
  discards the old results and recalculates them before showing the map or report.
  A layer created in the admin starts at `0`, before it has a raster. Missing means
  `1`.
- **pixel_size**: Pixel size in meters, the layer's declared resolution. The analysis
  doesn't use it: it measures each pixel from the raster's transform.
  Uploads and later edits must agree with the raster's measured pixel area within
  5% everywhere in the raster. For a geographic CRS (degrees) the cell area changes
  with latitude, so it is checked at the latitudes nearest to and farthest from the
  equator; a raster spanning too many latitudes is rejected (reproject it to an
  equal-area CRS or split it).
- **baseline** / **compared_against**: First and last year of the loss period. Layers
  of categories that are not `temporal` have none: both are `null`. Always write
  both keys, even as `null`: releases before categories fail on a missing key (see
  [Rolling back](#rolling-back-to-a-release-before-categories)).
- **category_id**: The layer's [category](#categories) in its country. Missing means
  `deforestation`.
- **references**: http(s) links shown with the layer.
- **available_countries_codes**: only in the flat layout, the countries the layer
  covers. In the per-country layout the folder says it.

The attributes files hold `name` and `alias` (required) plus the optional
`coverage`, `source`, `resolution`, `contentDate`, `updateFrequency` and
`publishDate`. Considerations are Markdown.

## Categories

A category groups a country's layers and says how a layer's result reads. The API
always returns the same `value` for a farm and a layer: the fraction of the farm inside
the layer's `1` pixels. The category tells the web what that means:

- **polarity**: `avoid` when coinciding with the layer is a finding (deforestation,
  protected areas): the finding is `value`. `required` when *not* coinciding is a
  finding (agricultural frontier): the finding is `1 - value`.
- **threshold**: a farm has findings when `100 × finding > threshold_percentage`.
  Without one, the global `DEFORESTATION_THRESHOLD_PERCENTAGE` applies.
- **result labels**: the wording of a result without findings (`ok`) and with
  findings (`flagged`), in both languages.

A country's categories live in `<CC>/categories.json`, a list like this one:

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

- **id**: lowercase letters, digits and `_`, starting with a letter. Never reused.
- **name** / **description**: both languages. **icon**: one of `forest`, `shield`,
  `agriculture`, `water`, `mountain`, `wetland`, `fire`, `layers`. **color**:
  `#rrggbb`.
- **threshold_percentage**: 0 to 100, or `null` for the global threshold.
- **temporal**: whether the category's layers have `baseline` and
  `compared_against`.
- **enabled**: a disabled category hides its layers from the public app.

Every country has a built-in **`deforestation`** category (`avoid`, `temporal`, the
global threshold), used when the file doesn't define one, so a country without
`categories.json` keeps working as before. A country that stores its own
`deforestation` replaces the built-in one. The flat layout has no categories file:
its only category is the built-in one.

`GET /categories?country=CC` returns a country's enabled categories, with both
languages and the threshold already resolved. `GET /maps` gives each layer's
`categoryId`.

**When a category is broken.** Each category in the file is checked on its own. A
layer whose category doesn't resolve is hidden from the public app, the rest of the
country keeps working, and the API logs an error naming the country, the layer and the
category. Analyses and tiles that already use the layer still resolve it by id. The
storage module tags the layer with the reason (`category_issue`), so the admin can
show it:

| Code | Why |
|---|---|
| `unknown_category` | The country has no category with that id. |
| `invalid_category` | The category is in the file but fails validation, or its id is repeated. |
| `unreadable_categories` | `categories.json` is not valid JSON or not a list, or can't be read: no category resolves, not even `deforestation`. A read error is retried on the next request. |

A stored `deforestation` that fails validation is not replaced by the built-in one: its
layers are hidden rather than judged with the global threshold instead of the
country's.

### Managing categories in the admin

The admin API manages the session's country's categories (`/admin/categories`; the
admin UI comes with GC-5):

- `GET /admin/categories` lists them, enabled or not, with their own threshold (`null`:
  the global one) and how many layers, and published layers, each has. It also says
  whether `categories.json` can be read (`readable`) and lists the problems of its
  entries (`errors`). A rejected entry is not listed.
- `POST /admin/categories` creates one, enabled, with an `id` the admin chooses. An id
  already used in the country, even by a rejected entry, and `deforestation` answer
  409.
- `PUT /admin/categories/{id}` replaces its fields. Editing the built-in
  `deforestation` stores it, first in the file. Editing a rejected entry repairs it.
- `PATCH /admin/categories/{id}` enables or disables it.

**A published layer never changes meaning in place.** The admin answers 400, and the
message names the layers to hide first, when:

| Action | Refused when |
|---|---|
| Disable or enable a category | it has published layers |
| Change a category's polarity | it has published layers |
| Change whether a category is temporal | it has any layer |
| Repair a rejected category, or create one whose id layers already use | any of those layers is published, or their years don't fit its `temporal` |
| Publish a layer | its category is disabled or doesn't resolve, or the layer's years don't fit it |
| Move a layer to another category | the layer is published |

Years fit when a temporal category's layers have both years and the others have
none, each year is an integer from 1900 to 2100 and the baseline is not after the
comparison year (the same rules as creating a layer). Thresholds, texts, icon and
color can change at any time. A repair keeps the entry's `enabled`: only `PATCH`
publishes or hides a category.

**What the public app offers, whatever edited the share.** `GET /maps` and
`GET /countries` only offer a layer whose `enabled` is `true` (a string like
`"false"` doesn't count), whose category resolves and is enabled, whose years fit
that category and whose raster file exists. Any other layer is hidden, logged once
as an error, and shown in the admin with `category_issue` or `layer_issue`
(`years_mismatch`, `missing_raster`). Like any hidden layer, it still resolves by id
for analyses already open.

Writes change one entry of `categories.json` and keep the others as they are stored,
rejected ones included, so nothing the API can't validate (a hand edit, a file from a
later release) is lost. When the file can't be read at all, every category write
answers 409 and the file is left alone: fix it on the share (it is in the share's
daily snapshot).

### Rolling back to a release before categories

Releases without categories ignore `category_id` and
`categories.json`: `GET /maps`, analyses, tiles and the admin keep working, and admin
edits keep each layer's `category_id`. Checked on 2026-11-16 by running that API
against a root with categories. What changes silently, and what to do **before
rolling back**:

- That release treats **every** layer as deforestation. A layer of a `required`
  category (agricultural frontier) would show inverted results. **Hide every layer
  whose category is not `deforestation`** in the admin.
- It only knows the global `DEFORESTATION_THRESHOLD_PERCENTAGE`. A country that stores
  its own `deforestation` with a `threshold_percentage` goes back to the global
  threshold, which applies to every country: **note it in the release notes**.
- It doesn't hide layers because of their category. Layers hidden today by a disabled
  or broken category (`category_issue`) are published again: **hide them in the admin
  first**.
- It answers 500 on `GET /maps` for a layer without a `baseline` or
  `compared_against` key, so the keys are always written (as `null` when empty).

## Managing layers in the admin

Log in at `/admin` with your country's admin passkey (see [Countries](#countries)).
The admin shows and changes only that country's layers. Then:

- **Create a layer**: choose its category and fill in the layer fields and the
  metadata in both languages. It belongs to your country, and starts unpublished and
  without a raster. The category must be enabled. A temporal category needs both
  years; any other takes none.
- **Upload its raster**, in the Raster section of the layer's page: choose the file,
  then "Upload and validate". The section shows each phase (uploading, validating
  pixels, converting) and can cancel it. The layer keeps its current raster until
  the new one has been fully processed. See the requirements below.
- **Publish or hide it**: a layer can only be published once it has a raster and while
  its category is enabled and valid. An
  unpublished layer's Raster section ends with a "Publish layer" step; the layers
  list also publishes and hides layers.
- **Edit it**: fields and metadata can be changed at any time, and the change is live
  immediately. Changing `pixel_size` is rejected if it disagrees with the current
  raster. A published layer can't move to another category: hide it first. The id,
  raster, version and published state are not edited there. The admin shows a
  layer whose category doesn't resolve (`category_issue`) so you can move it or
  repair the category.

Layers can't be deleted, only hidden. That keeps ids and past results stable.

A country appears on the app's start page once it has at least one layer that
`GET /maps` offers: published, with an enabled and valid category, years that fit it,
and its raster.

GFW and TMF were migrated as one copy per country. The copies are independent: when a
new GFW year comes out, each country's admin uploads it to their own copy, and
editing one country's metadata doesn't change the others.

## Countries

Countries are managed from the command line, in `apps/api` (in Azure, through
`tools/layers-ops/layers-ops.sh <env> countries`, see
[suggested_deployment.md](suggested_deployment.md#countries-and-admin-passkeys)):

```sh
uv run python -m app.modules.admin.countries list
uv run python -m app.modules.admin.countries add PE      # prints PE's admin passkey once
uv run python -m app.modules.admin.countries rotate PE   # new passkey; the old one stops working
uv run python -m app.modules.admin.countries disable PE  # hidden and admin locked out; data kept
uv run python -m app.modules.admin.countries enable PE
```

`--root <dir>` works on another root than `MAPS_ROOT`. The running API applies the
change on its next request: no restart. The exception is the first `add` on an empty
root: the admin routes are only registered at startup, so restart the API after it.
A new country starts with an empty folder and doesn't appear on the landing page
until its admin publishes a layer. Give each passkey only to that country's admin,
through a password manager.

## Raster requirements

Upload rasters already processed; the admin checks them but doesn't transform the
values. A raster must be:

- a GeoTIFF with **exactly one band** of **integer** values and a **coordinate
  reference system**;
- **binary**: only `0` (outside the layer), `1` (inside the layer) and, optionally, a
  nodata value. Every pixel is checked. Nodata cannot be `1`, because the analysis
  counts the `1` pixels as the layer.
- have a pixel area consistent with the layer's `pixel_size` (within 5% at every
  latitude of the raster).
- no larger than `ADMIN_MAX_UPLOAD_MB` (500 MB by default).

If the file doesn't declare its nodata value, enter it in the upload form.

The upload is rejected with an explanation when a check fails. In a layer of a
temporal category (one with a baseline, like `deforestation`), when the other values
all look like years (1980–2100) the raster has the year of each change instead of a
binary mask, and the error (`loss_years`) says to binarize it first (see below). In
any other layer, or one whose category doesn't resolve, the same raster is rejected
as not binary (`not_binary`). An upload with no `1` pixels is accepted, with the
warning `no_positive_pixels`.

### What happens to an upload

1. The whole raster is scanned to confirm it is binary, and its pixel size is
   compared with the layer before and after conversion.
2. It is converted to a Cloud Optimized GeoTIFF: DEFLATE compression, 512×512
   tiles and overviews resampled with `nearest`. Bit-packed samples are stored as
   8-bit.
3. The converted raster is compared with the upload pixel by pixel. Any difference
   aborts the upload.
4. It is saved as `<stem>-v<version>.tif`, and the index points the layer at it.
   `<stem>` is `layer-<id>` for layers created in the admin, and the original name
   for the seeded ones (e.g. `gfw`). A new layer's first raster is `v1`, because the
   layer is created at version 0.

Rasters are never overwritten: previous versions stay on the share. The admin has no
rollback button; to go back, point the layer's `raster_filename` in `index.json` at
the older file, or restore it from a backup.

Only one upload is processed at a time. A large raster takes about a minute
(57601×69601 pixels: 51 s on the Azure API).

Cancelling (`DELETE /admin/jobs/{jobId}`) stops the job within one window while it
validates or verifies, or when the conversion returns, and the layer keeps its
raster. Once the new raster is being put in place, it is too late to cancel (409).

The overviews make low-zoom tiles fast. Tiles and report images read the coarsest
overview whose pixel is still no larger than an output pixel, so at low zoom (zoom 11
and below for a 30 m layer; a report image of a farm more than about 10 km across) they
draw a downsampled version of the raster. Analyses always read the full resolution.

## Preparing public layers

**Global Forest Watch (GFW)** and **Tropical Moist Forests (TMF)** publish the year
each pixel lost its forest, not a binary mask. They have to be turned into one
before uploading: loss years later than the baseline become `1`, everything else
`0`.

The scripts in `tools/update-gfw-tmf` do this with the Google Earth Engine API:

- They read `loss_year` (GFW) or `DeforestationYear` (TMF).
- They clip the countries of interest (currently Ecuador, Colombia and Costa Rica).
- They download large areas in sections, then merge and compress the result.

## Seeding a new share

`uv run python -m app.modules.layers.seed --target <dir>` (in `apps/api`) turns the
Git-tracked layers into a layers root ready to upload: every raster goes through the
same checks and conversion as an admin upload and becomes `<stem>-v1.tif`, and every
layer is published at version 1. The result has the flat layout.

`uv run python -m app.modules.layers.migrate_countries --source <flat> --target <empty dir>`
then builds the per-country layout from it:

- each layer goes to every country it lists, so GFW and TMF get one copy per country;
- each country numbers its layers from 0, in the order of their original ids (today:
  GFW is 0 and TMF is 1 everywhere; then Ecuador's two layers are 2 and 3, IDEAM is
  2 in Colombia and MOCUPP is 2 in Costa Rica);
- `--mapping-out <file>` writes each country's old id → new id, for the parity check;
- rasters are copied whole, never clipped, because a farm can cross a border;
- every country is registered with a new passkey, printed once.

The source is left untouched. In Azure, `tools/layers-ops/layers-ops.sh <env> seed` runs both
commands and uploads the result to the share (see
[suggested_deployment.md](suggested_deployment.md#creating-an-environment-from-nothing)).
