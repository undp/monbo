## ADDED Requirements

### Requirement: The sample reports link GeoJSON to the production API

The sample reports the start page opens (`/files/examples/es/ejemplo-reporte.pdf` and `/files/examples/en/example-report.pdf`) SHALL link each farm sheet's "Descargar GeoJSON" / "Download GeoJSON" to the production API's `/download-geojson` (`https://monbo-api.orangerock-ea3c2f53.eastus.azurecontainerapps.io/download-geojson`). Each link SHALL carry, in its `content` parameter, a FeatureCollection with exactly one feature, the farm of that sheet, and the five sample farms SHALL each have one link. No link in the sample reports SHALL point at `localhost` or at another environment's API.

#### Scenario: A sample farm's GeoJSON link

- **WHEN** a reader of the English sample report opens "Download GeoJSON" on farm E1-003's sheet
- **THEN** the browser requests the production API's `/download-geojson` and receives a FeatureCollection with the single feature E1-003

#### Scenario: No local or non-production links

- **WHEN** the sample reports are regenerated with the GeoJSON link pointing at `localhost` or the dev environment's API
- **THEN** the web unit tests fail
