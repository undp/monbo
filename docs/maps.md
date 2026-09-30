# Deforestation layers

A layer is a binary GeoTIFF (`1` = forest loss after the baseline year, `0` = no
loss) plus its metadata in English and Spanish. The API analyzes farms against it,
serves its map tiles and draws it into the report images.

Layers are managed with the **layers admin** (`/admin` in the frontend). Editing the
files by hand is only for local work.

## Where layers live

The API reads layers from `MAPS_ROOT`:

| Environment | `MAPS_ROOT` | What it is |
|---|---|---|
| Azure | `/mnt/maps` | The `maps` Azure Files share, with backups ([suggested_deployment.md](suggested_deployment.md)) |
| Local, default | `app/maps` | The layers tracked in Git (Git LFS) |
| Local, trying the admin | `.local-maps` | A copy of `app/maps`, ignored by Git ([onboarding.md](onboarding.md#48-trying-the-layers-admin-locally)) |

The layers in Git are the source the share was seeded from. Admin changes only
reach the share: they are never committed.

Inside `MAPS_ROOT`:

```
index.json                                  # the list of layers
layers/rasters/<stem>-v<version>.tif        # one Cloud Optimized GeoTIFF per raster version
metadata/attributes/<en|es>/<name>.json     # name, alias, source... per language
metadata/considerations/<en|es>/<name>.md   # Markdown notes per language (optional)
.jobs/                                      # admin ingestion jobs (share only)
```

## The index

`index.json` is a list with one entry per layer:

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
  "available_countries_codes": ["EC", "CO", "CR"]
}
```

- **id**: Unique and never reused. New layers get the highest id plus one.
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
  Missing means `1`.
- **pixel_size**: Pixel size in meters; the analysis uses it for the pixel area.
  Uploads and later edits must agree with the raster's measured pixel area within
  5%. Geographic raster sizes are approximated at the middle latitude.
- **baseline** / **compared_against**: First and last year of the loss period.
- **references**: http(s) links shown with the layer.
- **available_countries_codes**: ISO 3166-1 alpha-2 codes of the countries covered.

The attributes files hold `name` and `alias` (required) plus the optional
`coverage`, `source`, `resolution`, `contentDate`, `updateFrequency` and
`publishDate`. Considerations are Markdown.

## Managing layers in the admin

Log in at `/admin` with the admin passkey (see
[suggested_deployment.md](suggested_deployment.md#layers-admin) for how it is
generated). Then:

- **Create a layer**: fill in the layer fields, the countries and the metadata in both
  languages. It starts unpublished and without a raster.
- **Upload its raster**: see the requirements below. The layer keeps its current
  raster until the new one has been fully processed.
- **Publish or hide it**: a layer can only be published once it has a raster.
- **Edit it**: fields and metadata can be changed at any time, and the change is live
  immediately. Changing `pixel_size` is rejected if it disagrees with the current
  raster. The id, raster, version and published state are not edited there.

Layers can't be deleted, only hidden. That keeps ids and past results stable.

## Raster requirements

Upload rasters already processed; the admin checks them but doesn't transform the
values. A raster must be:

- a GeoTIFF with **exactly one band** of **integer** values and a **coordinate
  reference system**;
- **binary**: only `0` (no loss), `1` (loss) and, optionally, a nodata value. Every
  pixel is checked. Nodata cannot be `1`, because the analysis counts `1` as loss.
- have a pixel size consistent with the layer's `pixel_size` (within 5%).
- no larger than `ADMIN_MAX_UPLOAD_MB` (500 MB by default).

If the file doesn't declare its nodata value, enter it in the upload form.

The upload is rejected with an explanation when a check fails. When the other values
look like years (1980–2100), the raster has loss years instead of a binary mask:
binarize it first (see below). An upload with no `1` pixels is accepted with a
warning.

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
   for the seeded ones (e.g. `gfw`). A layer's first raster is `v2`, because the
   layer is created at version 1.

Rasters are never overwritten: previous versions stay on the share. The admin has no
rollback button; to go back, point the layer's `raster_filename` in `index.json` at
the older file, or restore it from a backup.

Only one upload is processed at a time. A large raster takes about a minute
(57601×69601 pixels: 51 s on the Azure API).

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
layer is published at version 1. See
[suggested_deployment.md](suggested_deployment.md#first-time-setup).
