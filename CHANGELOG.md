## [Unreleased]

### Added

- Add a layers admin at `/admin` to create and edit deforestation layers, upload their rasters and publish or hide them, protected by a long shared passkey. The `/admin` API routes only exist when `ADMIN_PASSKEY_HASH` and `ADMIN_SESSION_SECRET` are set; generate them with `uv run python -m app.modules.admin.passkey`
- Validate uploaded rasters (one integer band, a CRS, only 0/1/nodata values, with a hint when the values look like loss years), convert them to Cloud Optimized GeoTIFFs, verify the conversion pixel by pixel and store them under versioned filenames (`<stem>-v<version>.tif`) without overwriting previous ones
- Add the `enabled` and `version` fields to the layers index. `GET /maps` lists only enabled layers and returns each layer's `version`, which the frontend adds to tile URLs
- Add the `MAPS_ROOT` environment variable to the API to read the layers from another directory (by default the Git-tracked `app/maps`), and report it in `/health`
- Add a seed command (`uv run python -m app.modules.layers.seed`) that prepares a layers root from the Git-tracked layers
- Add a 10-farm regression suite and a parity script (`uv run python -m tests.regression.parity`) that compares the results of two deployed APIs

### Changed

- In Azure, the API reads its layers from an Azure Files share mounted at `/mnt/maps`, in its own resource group with a delete lock, share soft delete and daily backups. `azure/deploy.sh storage` creates it, and the API app is rendered by `azure/render_api_app.py` instead of `azure/monbo-api-app.yml`
- The API image runs as uid/gid 10001

### Fixed

- Show layer names, aliases and considerations in the page's language (they were always in English)

### Other

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
