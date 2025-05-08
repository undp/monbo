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
