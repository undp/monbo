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
