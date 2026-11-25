## ADDED Requirements

### Requirement: The API reads geo files

`POST /farms/import` SHALL take one file (multipart) and accept these formats: GeoJSON (`.geojson`, `.json`), KML, KMZ and a Shapefile in a `.zip`.
- A `.zip` SHALL be read without extracting it to disk, and every `.shp` in it SHALL be read, so points and polygons can come as two Shapefiles in one `.zip`.
- Every layer of a KML or KMZ (its folders) SHALL be read.
- The answer SHALL list each feature, in file order, with its 1-based position, its attributes (JSON-safe: dates as ISO text, non-finite numbers as null), and its geometry as 2D WKT in EPSG:4326 with its type (`Point`, `Polygon` or `MultiPolygon`).

#### Scenario: Points and polygons in one zip

- **WHEN** a `.zip` holds a Shapefile of 4 polygons and one of 1 point
- **THEN** the answer lists the 5 features with their attributes

#### Scenario: KML with altitude

- **WHEN** a KML's coordinates carry an altitude
- **THEN** the WKT is 2D

### Requirement: Coordinates come in EPSG:4326

The API SHALL reproject every geometry to EPSG:4326. A GeoJSON, KML or KMZ without a CRS SHALL be read as EPSG:4326. A Shapefile without a `.prj` SHALL be rejected, since its coordinates could be in any CRS.

#### Scenario: Shapefile in UTM

- **WHEN** a Shapefile's `.prj` is UTM 17S
- **THEN** its geometries come back in longitude and latitude

#### Scenario: Shapefile without .prj

- **WHEN** a `.zip`'s Shapefile has no `.prj`
- **THEN** the upload is rejected with the code `missing_prj`

### Requirement: Polygons keep their holes and parts

A Polygon SHALL keep its holes. A MultiPolygon of one part SHALL be returned as that Polygon, and one of several parts as a MultiPolygon: one farm of several parts. Lines, points collections and empty geometries SHALL be reported for that feature, with its attributes still returned, so the web can name it.

#### Scenario: MultiPolygon of two parts

- **WHEN** a feature is a MultiPolygon of two polygons
- **THEN** it comes back as a MultiPolygon, without errors

#### Scenario: A line

- **WHEN** a feature is a LineString
- **THEN** it comes back without a geometry and with the error `unsupported_geometry`

### Requirement: Problems come back as error codes

Problems with the whole file SHALL be answered with an error code, a message and parameters, so the web can say them in the user's language:
- `unsupported_format`, `unreadable_file`, `no_shapefile`, `missing_prj`, `no_features` and `archive_too_large` answer 400;
- `file_too_large` answers 413.

Problems with one feature (`empty_geometry`, `unsupported_geometry`) SHALL come back in that feature's `errors`. The upload SHALL be limited to 20 MB, and a `.zip` or `.kmz` to 200 MB uncompressed.

#### Scenario: Oversized upload

- **WHEN** the file is larger than 20 MB
- **THEN** the answer is 413 with the code `file_too_large`

#### Scenario: Zip bomb

- **WHEN** a `.zip` would expand to more than 200 MB
- **THEN** the answer is 400 with the code `archive_too_large`, without expanding it
