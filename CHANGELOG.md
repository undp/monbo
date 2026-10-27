## [Unreleased]

### Added

- Add a layers admin at `/admin` to create and edit deforestation layers, upload their rasters and publish or hide them, protected by a long passkey per country. The `/admin` API routes only exist when `ADMIN_SESSION_SECRET` is set and `MAPS_ROOT` has the per-country layout (see below)
- Guide the admin's raster upload in steps (select the file, upload and validate, and publish the layer when it isn't published yet), showing the progress of each phase, with a Cancel button. Ingestion jobs report their `phase` and validation `progress`, and `DELETE /admin/jobs/{jobId}` cancels a job before its raster is activated
- Validate uploaded rasters (one integer band, a CRS, only 0/1/nodata values, with a hint when the values look like loss years), convert them to Cloud Optimized GeoTIFFs, verify the conversion pixel by pixel and store them under versioned filenames (`<stem>-v<version>.tif`) without overwriting previous ones
- Add the `enabled` and `version` fields to the layers index. `GET /maps` lists only enabled layers and returns each layer's `version`, which the frontend adds to tile URLs. A layer created in the admin starts at version 0, so its first raster is `v1`
- Add the `MAPS_ROOT` environment variable to the API to read the layers from another directory (by default the Git-tracked `app/maps`), and report it in `/health`
- Add a seed command (`uv run python -m app.modules.layers.seed`) that prepares a layers root from the Git-tracked layers
- Add a 10-farm regression suite and a parity script (`uv run python -m tests.regression.parity`) that compares the results of two deployed APIs
- Add a landing page to choose the analysis country first: one card per country with layers, with its silhouette, and a "Your country could be next" card that opens `NEXT_PUBLIC_CONTACT_URL` (hidden when unset)
- Add a country selector to the header. The country can change until a deforestation analysis exists; after that, changing it asks to start over
- Give each country its own layers and its own admin. Layers live in one folder per country under `MAPS_ROOT`, with a country registry (`countries.json`) holding each country's passkey hash. Manage countries with `uv run python -m app.modules.admin.countries add|list|rotate|disable|enable` (in Azure, `./azure/deploy.sh countries …`); changes apply without a restart
- Add `GET /countries` (the countries with at least one published layer) and a `country` filter to `GET /maps`. The landing page and the header selector use them
- Add a migration command (`uv run python -m app.modules.layers.migrate_countries`) that builds the per-country layout from the flat one, copying GFW and TMF into each country, and `tests.regression.parity --mapping` to compare both layouts
- Add unit tests to the web (Vitest, `pnpm test` in `apps/web`, also run by the root `pnpm test`): the formatting and domain helpers, upload validation against the real upload templates, en/es translation parity and the hooks that read the analysis data. CI runs them in the frontend job, renamed `Tests, type-check, lint, build` (it was `Type-check, lint, build`; the `dev` and `main` rulesets require the new name, see `docs/branch_protection.md`)
- Cover the web's context providers with unit tests: the analysis data (layer polling, analysis invalidation, the stored country, the flow kept across a language change), the admin session, and the report preview and downloads with their PDF worker client
- Accept farms with holes and farms of several parts (MultiPolygons), in WKT and GeoJSON. A MultiPolygon is one farm, with one ID and one declared production. Its area and deforestation ratio cover all its parts, and holes count for neither: loss inside a hole doesn't count, and a farm inside another's hole doesn't overlap it. The geometry type is read from the coordinates, so `Polygon` and `MultiPolygon` are interchangeable in the upload template. The maps draw every part with its holes empty, the vertex tables name each vertex's part and ring, each report image holds all of a farm's parts, and the GeoJSON and Excel downloads write a farm of several parts as a `MultiPolygon`. An Excel download reports a farm whose coordinates don't fit a cell, instead of cutting them

### Changed

- The frontend's API types are generated from the API's OpenAPI instead of written by hand. The API commits its contract as `apps/api/openapi.json` (admin routes included), the frontend generates `src/api/schema.d.ts` from it with `openapi-typescript`, and `pnpm contracts` regenerates both; CI fails when either is stale. The contract now matches the responses: the ingestion job routes declare their models, a farm's `polygon` and the polygon validation's inconsistencies are unions discriminated by `type` (including the `empty_polygon` kind the frontend didn't know), and fields every response includes are required. The JSON the API returns doesn't change
- The overlap and deforestation thresholds are configured only on the API (`OVERLAP_THRESHOLD_PERCENTAGE`, new `DEFORESTATION_THRESHOLD_PERCENTAGE`) and published at the new `GET /config`; the frontend loads them at startup instead of reading its own `NEXT_PUBLIC_OVERLAP_THRESHOLD_PERCENTAGE` / `NEXT_PUBLIC_DEFORESTATION_THRESHOLD_PERCENTAGE`, which are removed
- In Azure, the API reads its layers from an Azure Files share mounted at `/mnt/maps`, in its own resource group with a delete lock, share soft delete and daily backups. `azure/deploy.sh storage` creates it, and the API app is rendered by `azure/render_api_app.py` instead of `azure/monbo-api-app.yml`
- The API image runs as uid/gid 10001
- The module cards move from `/` to `/home` ("Home" and the logo in the header go to the landing page), and the module pages send the user to the landing page when no country is selected
- The layers admin needs the per-country layout and uses one passkey per country (`ADMIN_PASSKEY_HASH`, from earlier builds of this release, is ignored), and each admin only sees and edits their country's layers. Each country numbers its layers from 0, so `POST /deforestation_analysis/analize` and `POST /deforestation_analysis/generate-image` take a `country` in the body, and tiles move to `/deforestation_analysis/tiles/{country}/{id}/…` (the country is optional in the body with a flat root). The admin form no longer asks for countries. A flat root (like the Git-tracked `app/maps`) is still served, read-only
- In Azure the share holds the per-country layout at `/mnt/maps`. `./azure/deploy.sh seed` fills it from the Git-tracked layers (emptying it first after a confirmation), for a new environment or to start one over
- The deforestation modal and the deforestation upload page no longer have a country selector: they list the selected country's layers
- The upload templates no longer have a country column; every farm gets the selected country. An older file's country column must be empty or name the selected country; a file with farms in another country is rejected
- The API's production image shrinks from 1.69 GB to 647 MB: it no longer installs the system GDAL and compilers it never used (rasterio and pyogrio bundle their own GDAL), only `libexpat1`; dependencies install from prebuilt wheels only (`uv sync --no-build`). The dev image drops them too (2.48 GB → 1.4 GB)
- Merging into `dev` deploys the `dev` environment in Azure (`.github/workflows/deploy.yml`), as a managed identity trusted only for GitHub's `dev` environment (no stored Azure credentials), with automatic rollback of failed deploys
- The Azure environment is declared in Terraform (`infra/terraform/`, stacks `platform` and `apps`, one `envs/<env>.tfvars` per environment) and deployed with `infra/deploy.sh <env>`. `azure/deploy.sh`, `render_api_app.py` and `deploy.env` are removed: seeding the share and managing countries move to `tools/layers-ops/layers-ops.sh <env> seed|countries`. The container registry's admin user is off (the apps pull with a managed identity), logs go to a declared Log Analytics workspace, and the development environment is rebuilt as `dev` under new names (`monbo-dev-*`), so its URLs change. The Azure subscription is no longer in any repository file (`ARM_SUBSCRIPTION_ID`)
- The repository moves to `apps/` and `tools/`: `monbo-api/` is now `apps/api/`, `monbo-front/` is `apps/web/`, and `scripts/update-gfw-tmf/` is `tools/update-gfw-tmf/`. Package, image, Container App and CI job names don't change
- The PDF report renders in a Web Worker, so the page no longer freezes while it is generated. The report page fetches its images once and shares them between the preview and both downloads, and pre-renders the complete report once the preview is shown, so "Download" saves it at once. On the reference report (50 farms × 3 layers, production build): preview 34.3 s → 8.7 s, complete download 43.7 s → 0.04 s, separated download (ZIP) 395 s → 7.5 s
- `POST /deforestation_analysis/generate-image` returns a JPEG (about 5× smaller than the previous PNG), so the complete PDF goes from 42 MB to 17 MB. The API fetches each farm's satellite image from Google Static Maps once for all layers (an in-memory cache of 10 minutes), keeps rasters open between requests and draws the images in threads: a report makes one Google call per farm instead of one per farm and layer
- The report's fonts (Roboto, Apache 2.0) are served by the frontend instead of `fonts.gstatic.com`, and the cover image is lighter
- `NEXT_PUBLIC_MAX_REQUESTS_FOR_SATELLITE_BACKGROUND_AT_DEFORESTATION_IMAGE_GENERATION` counts distinct farms, which is what costs Google calls, instead of farm × layer pairs
- The deforestation analysis table no longer shows the "EU Official" chip in the first layer's header; the column keeps its light blue background
- The overlap percentage in the polygon validation is the overlap's area divided by the smaller farm's area, instead of by the two farms' union. A farm inside another, or nearly inside, now scores close to 100% and is flagged HIGH; before, a small farm inside a large one could stay valid. Overlap percentages shown in the table and the Excel download go up for the same data. The threshold (`OVERLAP_THRESHOLD_PERCENTAGE`) and the HIGH cut (above 80%) don't change
- Reports of more than 1000 farm pages (selected farms × layers with a result) are delivered only as a ZIP with one PDF per farm, built farm by farm while a card centered on the page shows the percentage and the farms done, with a Cancel button. Their preview shows the first farm. Before, the preview of a report of about 3500 pages (500 farms × 7 layers, or 1000 × 4) ran the tab out of memory and nothing could be downloaded; 1000 farms × 5 layers now download in about 3 minutes (~245 MB)
- Selecting farms for the report stays responsive with 1000 farms (a click blocked the page for 300–430 ms), and the result tables no longer re-render every row on each change or mouse move
- An upload with many invalid rows shows its first 5 errors and one notice with the count of the rest, instead of one notice per row
- The report preview says when the report is above the satellite background limit (`NEXT_PUBLIC_MAX_REQUESTS_FOR_SATELLITE_BACKGROUND_AT_DEFORESTATION_IMAGE_GENERATION`, 90 farms on `dev`) and its maps go without the satellite image, instead of showing them on the solid green background without explanation
- The deforestation percentage of a farm is the share of its area on loss pixels: each loss pixel counts by the part of it inside the farm, measured in the raster's CRS. Before, every loss pixel the farm touched counted whole (`pixels × pixel_size² / area`, capped at 100%), which over-estimated small farms and those with loss along their edge. For example, a farm of 2.73 ha with 66.7% of its area on loss showed 100%, and in a 500-farm upload 3 to 6 farms per layer were flagged above the 2% threshold by a loss pixel that only grazed their edge. In the 500-farm upload used to check the change (GFW, TMF and both MAATE layers) every percentage stayed equal or went down; a percentage can go up where a layer's real cells are larger than its nominal `pixel_size` (IDEAM's are 929.6 m², not 900), since the layer's `pixel_size` no longer enters the calculation. `/analize` is not slower. The method is documented in `docs/deforestation_calculation.md`
- A polygon farm's `details.path` (one ring) is replaced by `parts`, a list of `{exterior, holes}`, in `/farms/parse`'s response and in what `/polygons_validation/validate` and `/deforestation_analysis/analize` receive; an overlap's `paths` is replaced by `parts` too. The API returns exteriors counter-clockwise and holes clockwise, and a farm's `center` is now a point inside it (its centroid when that lies inside, as for every farm before). The web and the API must be deployed together

### Fixed

- The map's deforestation layers and the report's maps draw each loss pixel where the raster puts it. They were off by up to one pixel (about 13 m up and to the left around a test farm in Ecuador), because the raster was resampled twice: first onto a Web Mercator grid of its own, then onto the tile or image. They are now reprojected in one step onto the tile's or image's grid, using the raster's overviews at low zoom. The deforestation percentages didn't change: they never used that drawing. Tiles are also faster at every zoom (a z6 tile of a raster without overviews: 2.8 s → 0.4 s). Browsers may keep showing cached tiles for up to a day
- In the report's maps, the farm's outline is drawn above the deforestation (it was hidden under it where the loss crosses the farm's edge), as on the web map
- The report's maps no longer cut off tall farms at the top and bottom: `POST /deforestation_analysis/generate-image` returns 640×420 images (they were 500×500), in the aspect ratio of the map box on the farm page, which shows them whole
- A farm with an invalid polygon (for example, one that crosses itself) got a negative deforestation ratio, which the web showed as deforestation-free. Its ratio is now empty (N/A), as is that of an empty polygon
- The polygon validation no longer fails with a 500 when two farms overlap and also share an edge, when two tiny farms only touch, or when a polygon has a single vertex. Farms that only share an edge or a vertex are not an overlap, and a single-vertex polygon is reported as an invalid geometry
- A GeoJSON polygon with holes was read as one self-intersecting ring, and a WKT polygon with holes was analysed as its outer ring, with a deforestation ratio that was too low. Polygons with holes are now read with their holes, in both formats (see Added)
- Show layer names, aliases and considerations in the page's language (they were always in English)
- Keep retained farms and report selections aligned with the analysis country, and ignore analysis responses from an earlier country or layer selection
- Accept only `https:` and `mailto:` links for the landing page contact button
- The separated reports download no longer fetches every image again (it made up to 300 image requests and took minutes), and the report preview no longer regenerates itself when the page's state changes
- The report's satellite background no longer turns off from 34 farms with 3 layers
- Show an error with a "Retry" button when the report preview can't be generated, instead of a blank page
- With a 1% overlap or deforestation threshold, percentages above it lost their decimal (1.4% showed as "1%", 10.5% as "10%"). Values above a threshold now show as many decimals as the threshold has, and at least one, in the tables, the map and the Excel and GeoJSON downloads
- The "below the threshold" label follows the page's language ("< 0,5%" in Spanish, not "< 0.5%")
- An admin session configured to last more than about 24.8 days (`ADMIN_SESSION_TTL_MINUTES` above ~35,790) no longer ends right after logging in: the browser fires a longer timer at once, so the sign-out now waits in steps until the real expiry
- The Excel downloads of the polygon validation and the deforestation analysis put most values under the wrong headers. From the sixth column on, each value sat one header off: the country under "Region", the region under "Coordinates format", and so on, and the overlap percentage was merged in a document link column. The rows follow the upload template's columns again:
  - the coordinates are written as GeoJSON, with their format and geometry type;
  - the country column the template no longer has is dropped;
  - quantity and area are numbers.

  A download can now be uploaded again: the deforestation download kept only 2 of the template's 3 header rows, so its first farm was read as the example row, and a decimal quantity like 1200.5 was rejected in Spanish
- A layer an admin enabled took up to five minutes to show up for users who already had the app open (the web only fetched the countries and layers on load and every five minutes). The web now fetches them again when the user returns to the tab or the window, and the deforestation modal and the deforestation upload page fetch the layers when they open, at most once every 30 seconds per list

### Security

- Read uploaded Excel files with SheetJS 0.20.3, installed from SheetJS's CDN, instead of `xlsx` 0.18.5 from npm, which is vulnerable to prototype pollution and ReDoS and has no fixed version on npm. Date cells no longer carry a spurious 45-second offset
- Update vulnerable transitive dependencies (`brace-expansion`, `tmp`, `yaml`, `@babel/runtime`, `mdast-util-to-hast`, `source-map-js`, `@humanfs/node`), and override `uuid` (under `exceljs`) and `shell-quote` (under the root's `concurrently`), whose parents pin vulnerable versions
- Stop logging the Google Maps API key and request signature: the satellite image's debug line logged the full request URL, and an HTTP error from Google logged its message, which contains that URL. Both now log only the request's parameters or the status code
- Turn on secret scanning with push protection and CodeQL code scanning for the repository (`docs/branch_protection.md`)

### Other

- Remove Next.js build output that was committed by mistake under `monbo-front/monbo-front/.next/`
- Document how layers are managed (`docs/maps.md`), the Azure deployment (`docs/suggested_deployment.md`) and trying the admin locally (`docs/onboarding.md`)

## [1.5.1] - 2025-05-12

### Added

- Create decorator for measuring method times at API

### Changed

- Improve performance of generating random IDs for farms
- Improve performance of parsing farm coordinates string
- Improve performance when calculating polygons areas
- Move farms generation to a helper method
- Move GeometryCalculator helper class to another folder

### Fixed

- Show "testing environment" warning on all pages and use the enviromental variable in all cases
- Make region attribute optional when parsing farms data at API
- Make area column optional when uploading excel file

### Other

- Add new enviromental variables to azure container apps YML template file

## [1.5.0] - 2025-05-07

### Added

- Add new `NEXT_PUBLIC_SHOW_TESTING_ENVIRONMENT_WARNING` enviromental variable to frontend for customize showing the "testing environment" warning at homepage
- Add new `NEXT_PUBLIC_MAX_REQUESTS_FOR_SATELLITE_BACKGROUND_AT_DEFORESTATION_IMAGE_GENERATION` enviromental variable to frontend for customize the max number of images that can be requested to include a satellite background at generated images for deforestation PDF report. The goal was avoid the performance degradattion.

### Changed

- Make `area` column optional in excel file uploading. If not provided for point type farms the system will assume a default area of 1 hectare.
- Hide toolbar when previewing the deforestation PDF report with `react-pdf/renderer` library
- Handle both languages (English and Spanish) when uploading and downloading excel files and templates. Also parse it's content (float values) based on the language selected at the frontend.
- Refactored frontend code to move page components to appropiate folders
- Simplified the route for generating deforestation images for PDF report. The previous route was `/deforestation_analysis/map_generation/generate-for-polygon`. The new route is `/deforestation_analysis/generate-image`

### Fixed

- Exclude invalid shapely polygons for overlap detection to avoid shapely errors
- Hide links from PDF previewer to avoid the user navigating away from the app
- Solve duplicated component keys react error

### Other

- Updated packages versions at frontend
