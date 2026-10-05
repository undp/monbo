# Deforestation layers

A layer is a binary GeoTIFF (`1` = forest loss after the baseline year, `0` = no
loss) plus its metadata in English and Spanish. The API analyzes farms against it,
serves its map tiles and draws it into the report images.

Every layer belongs to one country, and each country has its own admin. Layers are
managed with the **layers admin** (`/admin` in the frontend). Editing the files by
hand is only for local work.

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
CO/layers/rasters/<stem>-v<version>.tif          # one Cloud Optimized GeoTIFF per raster version
CO/metadata/attributes/<en|es>/<name>.json       # name, alias, source... per language
CO/metadata/considerations/<en|es>/<name>.md     # Markdown notes per language (optional)
EC/...  CR/...                                   # the same for every other country
.jobs/                                           # admin ingestion jobs (share only)
```

`countries.json` lists each country's ISO 3166-1 alpha-2 `code`, the SHA-256 of its
admin passkey (`passkey_hash`, never the passkey) and whether it is `enabled`. It is
managed with the countries command (see [Countries](#countries)), never by hand.

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
  "references": ["https://glad.earthengine.app/view/global-forest-change"]
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
- **pixel_size**: Pixel size in meters; the analysis uses it for the pixel area.
  Uploads and later edits must agree with the raster's measured pixel area within
  5% everywhere in the raster. For a geographic CRS (degrees) the cell area changes
  with latitude, so it is checked at the latitudes nearest to and farthest from the
  equator; a raster spanning too many latitudes is rejected (reproject it to an
  equal-area CRS or split it).
- **baseline** / **compared_against**: First and last year of the loss period.
- **references**: http(s) links shown with the layer.
- **available_countries_codes**: only in the flat layout, the countries the layer
  covers. In the per-country layout the folder says it.

The attributes files hold `name` and `alias` (required) plus the optional
`coverage`, `source`, `resolution`, `contentDate`, `updateFrequency` and
`publishDate`. Considerations are Markdown.

## Managing layers in the admin

Log in at `/admin` with your country's admin passkey (see [Countries](#countries)).
The admin shows and changes only that country's layers. Then:

- **Create a layer**: fill in the layer fields and the metadata in both languages. It
  belongs to your country, and starts unpublished and without a raster.
- **Upload its raster**, in the Raster section of the layer's page: choose the file,
  then "Upload and validate". The section shows each phase (uploading, validating
  pixels, converting) and can cancel it. The layer keeps its current raster until
  the new one has been fully processed. See the requirements below.
- **Publish or hide it**: a layer can only be published once it has a raster. An
  unpublished layer's Raster section ends with a "Publish layer" step; the layers
  list also publishes and hides layers.
- **Edit it**: fields and metadata can be changed at any time, and the change is live
  immediately. Changing `pixel_size` is rejected if it disagrees with the current
  raster. The id, raster, version and published state are not edited there.

Layers can't be deleted, only hidden. That keeps ids and past results stable.

A country appears on the app's landing map once it has at least one published layer.

GFW and TMF were migrated as one copy per country. The copies are independent: when a
new GFW year comes out, each country's admin uploads it to their own copy, and
editing one country's metadata doesn't change the others.

## Countries

Countries are managed from the command line, in `monbo-api` (in Azure, through
`./azure/deploy.sh countries`, see
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
- **binary**: only `0` (no loss), `1` (loss) and, optionally, a nodata value. Every
  pixel is checked. Nodata cannot be `1`, because the analysis counts `1` as loss.
- have a pixel area consistent with the layer's `pixel_size` (within 5% at every
  latitude of the raster).
- no larger than `ADMIN_MAX_UPLOAD_MB` (500 MB by default).

If the file doesn't declare its nodata value, enter it in the upload form.

The upload is rejected with an explanation when a check fails. When the other values
look like years (1980–2100), the raster has loss years instead of a binary mask:
binarize it first (see below). An upload with no `1` pixels is accepted (its job
records a warning).

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

The overviews make low-zoom tiles fast, and at low zoom levels they draw a
downsampled version of the raster. Analyses and report images always read the full
resolution.

## Preparing public layers

**Global Forest Watch (GFW)** and **Tropical Moist Forests (TMF)** publish the year
each pixel lost its forest, not a binary mask. They have to be turned into one
before uploading: loss years later than the baseline become `1`, everything else
`0`.

The scripts in `scripts/update-gfw-tmf` do this with the Google Earth Engine API:

- They read `loss_year` (GFW) or `DeforestationYear` (TMF).
- They clip the countries of interest (currently Ecuador, Colombia and Costa Rica).
- They download large areas in sections, then merge and compress the result.

## Seeding a new share

`uv run python -m app.modules.layers.seed --target <dir>` (in `monbo-api`) turns the
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

The source is left untouched. In Azure, `./azure/deploy.sh seed` runs both commands
and uploads the result to the share (see
[suggested_deployment.md](suggested_deployment.md#first-time-setup)).
