## ADDED Requirements

### Requirement: The upload section explains how farms come in

The farm upload section SHALL explain, in plain language:

- **The four ways to upload farms**, and when each one fits: the Excel template; a geo file with the farms' data; a geo file joined to an Excel by ID; and drawing a farm on the map.
- **Accepted formats:** the Excel template, with coordinates as WKT or GeoJSON in a cell, and geo files in GeoJSON, KML, KMZ or a Shapefile in a `.zip`.
- **Accepted geometry:**
  - polygons and MultiPolygons, with or without holes, and points;
  - coordinates are longitude and latitude in WGS84 (longitude −180 to 180, latitude −90 to 90);
  - a geo file in another coordinate system is converted to WGS84 when it is read;
  - a Shapefile without its `.prj` file is rejected;
  - lines and other geometries are rejected.
- **A point farm's area:** it is the area declared for it, in the Excel or in the geo file's attributes, and 1 ha when none is given; a point drawn on the map requires its area.

Its "More detail" SHALL list the accepted attribute names of a geo file and the size limits (20 MB per file, 200 MB uncompressed for a `.zip` or `.kmz`). The section SHALL NOT repeat the steps that each upload card already shows in the app.

#### Scenario: Choosing a way to upload

- **WHEN** a user with a Shapefile of farms and an Excel with their production data reads the upload section
- **THEN** it tells them to use the geo file joined to an Excel by ID

#### Scenario: Shapefile without .prj

- **WHEN** a user reads the upload section
- **THEN** it states that a Shapefile without its `.prj` file is rejected, because its coordinates can't be placed

#### Scenario: A point farm's area

- **WHEN** a user reads the upload section
- **THEN** it states where a point farm's area comes from in each way to upload, and that it is 1 ha when the Excel or the geo file gives none

### Requirement: Each section has a summary and collapsible details

Each section SHALL start, below its heading, with an **"In short"** box ("En resumen" in Spanish) of two or three points. The section's essential rules SHALL be readable with its "More detail" blocks closed. Worked computations, edge cases and exact figures SHALL be in collapsible **"More detail"** blocks ("Más detalle"), closed when the page opens. A user SHALL be able to open and close each block with the mouse and with the keyboard.

The Markdown SHALL mark a summary and a collapsible block with container directives (`:::summary`, `:::details[label]`), with no raw HTML. Both languages SHALL have the same number of summaries and of "More detail" blocks in each section.

With every "More detail" block closed, the page's Spanish text SHALL be at most 1,100 words.

#### Scenario: Summary first

- **WHEN** a user opens `/documentation#deforestation`
- **THEN** the first thing below the section's heading is its "En resumen" box

#### Scenario: Details closed by default

- **WHEN** a user opens `/documentation`
- **THEN** every "Más detalle" block is closed, and clicking one, or focusing it and pressing Enter, opens it

#### Scenario: Languages in step

- **WHEN** the unit tests compare a section's Spanish and English content
- **THEN** both have one summary and the same number of "More detail" blocks

#### Scenario: Unknown directive

- **WHEN** a section's Markdown uses a directive other than `summary` or `details`
- **THEN** a unit test fails

## MODIFIED Requirements

### Requirement: A documentation page explains the methods

The web SHALL serve a documentation page at `/documentation` in Spanish and at `/en/documentation` in English. It SHALL be written for the app's users (producers, cooperatives, exporters, auditors), not for developers. The page SHALL have four sections, in this order, each in an element whose `id` is fixed and the same in both languages:

- farm upload (`upload`);
- polygon validation (`validation`);
- farm area (`area`);
- deforestation (`deforestation`).

The page's subtitle SHALL name the four topics. A short index at the top SHALL link to the four anchors. Opening the page with an anchor SHALL scroll to that section with its heading visible below the fixed header. The page SHALL NOT require an analysis country to be selected.

#### Scenario: Spanish page

- **WHEN** a user opens `/documentation`
- **THEN** the page shows the four sections in Spanish, in the order upload, validation, area, deforestation

#### Scenario: English page

- **WHEN** a user opens `/en/documentation`
- **THEN** the page shows the same four sections in English, with the same ids

#### Scenario: Direct link to a section

- **WHEN** a user opens `/documentation#deforestation`
- **THEN** the page scrolls to the deforestation section and its heading is not hidden by the header

#### Scenario: Direct link to the new section

- **WHEN** a user opens `/documentation#upload`
- **THEN** the page scrolls to the farm upload section

#### Scenario: No country selected

- **WHEN** a user with no analysis country selected opens `/documentation`
- **THEN** the page is shown and the user is not redirected to the landing page

### Requirement: The validation section covers every check

The polygon validation section SHALL explain, in plain language:

- **Invalid geometries:** an empty polygon, a polygon with fewer than 3 distinct points, a self-intersecting polygon, a hole outside its part's boundary, and parts of the same farm that overlap each other.
- **Overlaps between farms:**
  - an overlap's percentage is the area shared by two farms divided by the area of the smaller one;
  - it is reported only when it is above the overlap threshold;
  - it is graded HIGH above 80%, and MEDIUM otherwise;
  - farms that only share an edge or a vertex don't overlap, and neither does a farm inside another's hole;
  - a farm given as a point takes part as a circle built from its declared area, approximately.
- **The result:** a farm with any of these problems is marked as not valid.
- **An optional step:** the validation is a separate module; farms uploaded directly in the deforestation analysis are not checked for overlaps, so a deforestation result does not show that they don't overlap.

The accepted geometry SHALL be explained in the farm upload section, which the validation section links to instead of repeating it.

#### Scenario: Overlap rule stated

- **WHEN** a user reads the validation section
- **THEN** it states that the overlap percentage is measured against the smaller farm, that it is reported above the deployment's overlap threshold, and that it is graded HIGH above 80%

#### Scenario: Invalid geometries listed

- **WHEN** a user reads the validation section
- **THEN** it names each geometry problem that makes a farm invalid and shows an example image of an overlap, a self-intersection and a polygon with too few points

#### Scenario: Accepted geometry not repeated

- **WHEN** a user reads the validation section
- **THEN** it links to the farm upload section for the accepted formats and geometries, and does not list them again

### Requirement: The area section explains how a farm is measured

The farm area section SHALL explain that:

- a farm's area is measured on the Earth's ellipsoid (WGS84), with no map projection, and is shown in hectares;
- the ellipsoid area adds, for each edge of the farm, the area between that edge and the equator: the same idea as Gauss's area formula, applied to the curved Earth. Gauss's formula itself is not what gives the hectares;
- a hole's area is subtracted, and the areas of a farm's several parts are added;
- a farm given as a point has the area declared for it (see the farm upload section), and is analysed as a circle centred on the point whose radius comes from that area; the circle is drawn in degrees, so it covers somewhat less ground than declared away from the equator, by the same figures as `docs/polygon_area_calculation.md` (1.5% at 10° of latitude, 13% at 30°);
- this area is the one shown in the app and the one overlaps are measured against, and it decides whether a farm can be analysed for deforestation;
- the deforestation percentage does not divide by this area: its numerator and denominator are both measured on the map layer, in the layer's coordinates.

#### Scenario: Holes and parts

- **WHEN** a user reads the area section
- **THEN** it states that holes are subtracted and parts are added

#### Scenario: Farm given as a point

- **WHEN** a user reads the area section
- **THEN** it states that a point farm is treated as a circle built from its declared area, and that the circle's area is an approximation

#### Scenario: Hectares and Gauss's formula told apart

- **WHEN** a user reads the area section
- **THEN** it states that the hectares are measured on the ellipsoid, and that Gauss's formula, explained in the deforestation section, is not what gives them

#### Scenario: Circle figures match the technical document

- **WHEN** a user reads the area section's figures for the point circle
- **THEN** they are 1.5% at 10° of latitude and 13% at 30°, as in `docs/polygon_area_calculation.md`

### Requirement: The deforestation section explains the percentage

The deforestation section SHALL explain:

- **The percentage:** the share of the farm's area that lies on the layer's loss pixels, written as a plain-text formula, with both areas measured on the layer rather than with the area shown in the app.
- **Partial pixels:** a pixel the farm covers only in part counts by that part alone, with a diagram of a loss pixel cut by the farm's edge.
- **How each area is measured:**
  - every piece of a loss pixel inside the farm, and the farm itself, is a polygon given by its corners;
  - its area is computed with Gauss's area formula (the shoelace formula), `A = ½ · | Σ (xᵢ · yᵢ₊₁ − xᵢ₊₁ · yᵢ) |`, in the layer's coordinates;
  - in the body: why the formula works (each edge forms a signed triangle with the origin, and the parts outside the polygon cancel out), with a diagram;
  - in "More detail": the 300 m² piece of the worked example, with corners (0, 0), (30, 0), (30, 5) and (0, 15), computed edge by edge.
- **A worked example:** a 1 ha farm on 30 m pixels, with two loss pixels inside it and a third on its edge, giving 21%.
- **The threshold:** a farm is flagged when its percentage is above the deforestation threshold.
- **No result:** a farm gets no percentage when its polygon is empty, invalid or has no area, when it lies outside the layer, or when the layer can't be read.
- **The limit of the method:** the precision stops at the layer's pixel, since a loss pixel is taken as lost forest as a whole.

#### Scenario: Partial pixel

- **WHEN** a user reads the deforestation section
- **THEN** it states that a loss pixel the farm only partly covers adds only the part inside the farm, and it includes the 1 ha example

#### Scenario: Gauss's formula

- **WHEN** a user reads the deforestation section
- **THEN** it names Gauss's area formula as the way each area of the percentage is measured, writes the formula, and explains why it works

#### Scenario: Gauss's formula worked out

- **WHEN** a user opens the deforestation section's "More detail" on Gauss's formula
- **THEN** it computes the area of the polygon (0, 0), (30, 0), (30, 5), (0, 15) edge by edge, giving ½ · 600 = 300 m², the piece of the third pixel in the 1 ha example

#### Scenario: Farm with no result

- **WHEN** a user reads the deforestation section
- **THEN** it lists the cases in which a farm gets no percentage

### Requirement: The page shows the deployment's thresholds

Wherever the page mentions the overlap threshold or the deforestation threshold, it SHALL show the values the web loaded from `GET /config`, formatted as a percentage in the page's language with the threshold's own decimal places. The thresholds SHALL NOT be written into the page's text. The Spanish and English content SHALL use the same placeholders, and no placeholder SHALL be left unreplaced in the rendered page, inside a "More detail" block or outside one.

#### Scenario: Thresholds from the API

- **WHEN** `GET /config` returns `overlapThresholdPercentage` 1 and `deforestationThresholdPercentage` 2, and a user opens `/documentation`
- **THEN** the validation section mentions an overlap threshold of 1% and the deforestation section a threshold of 2%

#### Scenario: Decimal threshold in English

- **WHEN** `deforestationThresholdPercentage` is 0.5 and a user opens `/en/documentation`
- **THEN** the deforestation section shows the threshold as 0.5%

#### Scenario: Threshold of 0

- **WHEN** `overlapThresholdPercentage` is 0
- **THEN** the validation section shows 0% as the threshold, and the sentence remains accurate

#### Scenario: Languages in step

- **WHEN** the unit tests compare the Spanish and English content
- **THEN** both have the same four sections and use the same placeholders, and every placeholder is a known one

### Requirement: The page and the technical documentation point to each other

Each section of the page SHALL end with a link to its technical document in the repository, on the `dev` branch:

- upload → the "How farms come in" section of `docs/architecture.md`;
- validation → the polygon-validation section of the API's README;
- area → `docs/polygon_area_calculation.md`;
- deforestation → `docs/deforestation_calculation.md`.

`docs/polygon_area_calculation.md` SHALL contain the technical explanation of the farm area. The repository's technical documents, `docs/architecture.md`'s "How farms come in" included, SHALL name the page's Markdown files as the user-facing version that must be updated along with them.

#### Scenario: Link to the technical detail

- **WHEN** a user reaches the end of the deforestation section
- **THEN** a link opens `docs/deforestation_calculation.md` in the repository

#### Scenario: Link from the upload section

- **WHEN** a user reaches the end of the farm upload section
- **THEN** a link opens the "How farms come in" section of `docs/architecture.md` in the repository

#### Scenario: Area document no longer empty

- **WHEN** a developer opens `docs/polygon_area_calculation.md`
- **THEN** it explains how a farm's area is computed (geodesic area on WGS84, holes and parts, point farms)

#### Scenario: Architecture names the upload page

- **WHEN** a developer reads "How farms come in" in `docs/architecture.md`
- **THEN** it names `apps/web/src/content/documentation/{es,en}/upload.md` as the user-facing version to update with it
