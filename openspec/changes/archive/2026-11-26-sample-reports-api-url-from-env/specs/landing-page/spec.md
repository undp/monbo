## MODIFIED Requirements

### Requirement: The sample reports link GeoJSON to the production API

The sample reports the start page opens (`/files/examples/es/ejemplo-reporte.pdf` and `/files/examples/en/example-report.pdf`) SHALL link each farm sheet's "Descargar GeoJSON" / "Download GeoJSON" to the production API's `/download-geojson`, whose base URL is the `SAMPLE_REPORTS_API_URL` environment variable (in CI, the repository variable of the same name), not a value written in the code. Each link SHALL carry, in its `content` parameter, a FeatureCollection with exactly one feature, the farm of that sheet, and the five sample farms SHALL each have one link. All the GeoJSON links SHALL share one `https` origin, and no link in the sample reports SHALL point at `localhost`. The web unit tests SHALL check the links against `SAMPLE_REPORTS_API_URL` whenever it is set, and SHALL fail in CI when it is not set.

#### Scenario: A sample farm's GeoJSON link

- **WHEN** a reader of the English sample report opens "Download GeoJSON" on farm E1-003's sheet
- **THEN** the browser requests the production API's `/download-geojson` and receives a FeatureCollection with the single feature E1-003

#### Scenario: No local or non-production links

- **WHEN** the sample reports are regenerated with the GeoJSON link pointing at `localhost` or at an API other than `SAMPLE_REPORTS_API_URL`
- **THEN** the web unit tests fail

#### Scenario: Production's API URL changes

- **WHEN** the repository variable `SAMPLE_REPORTS_API_URL` is changed and the sample reports are not regenerated
- **THEN** the web job's tests fail in CI until both PDFs are regenerated with the new URL

#### Scenario: CI without the variable

- **WHEN** the web unit tests run with `CI` set and `SAMPLE_REPORTS_API_URL` unset
- **THEN** they fail, naming the missing variable
