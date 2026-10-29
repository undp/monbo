# methodology-documentation Specification

## Purpose
The web's documentation page, written for the app's users rather than its developers: how farms are validated, how their area is measured and how deforestation is calculated, with the deployment's thresholds. It is opened from the header, on every page.
## Requirements
### Requirement: A documentation page explains the methods

The web SHALL serve a documentation page at `/documentation` in Spanish and at `/en/documentation` in English. It SHALL be written for the app's users (producers, cooperatives, exporters, auditors), not for developers. The page SHALL have three sections, in this order, each in an element whose `id` is fixed and the same in both languages:

- polygon validation (`validation`);
- farm area (`area`);
- deforestation (`deforestation`).

A short index at the top SHALL link to the three anchors. Opening the page with an anchor SHALL scroll to that section with its heading visible below the fixed header. The page SHALL NOT require an analysis country to be selected.

#### Scenario: Spanish page

- **WHEN** a user opens `/documentation`
- **THEN** the page shows the three sections in Spanish, in the order validation, area, deforestation

#### Scenario: English page

- **WHEN** a user opens `/en/documentation`
- **THEN** the page shows the same three sections in English, with the same ids

#### Scenario: Direct link to a section

- **WHEN** a user opens `/documentation#deforestation`
- **THEN** the page scrolls to the deforestation section and its heading is not hidden by the header

#### Scenario: No country selected

- **WHEN** a user with no analysis country selected opens `/documentation`
- **THEN** the page is shown and the user is not redirected to the landing page

### Requirement: The validation section covers every check

The polygon validation section SHALL explain, in plain language:

- **Accepted geometry:** polygons and MultiPolygons, with or without holes, in WKT or GeoJSON, with WGS84 coordinates (longitude −180 to 180, latitude −90 to 90), and points.
- **Invalid geometries:** an empty polygon, a polygon with fewer than 3 distinct points, a self-intersecting polygon, a hole outside its part's boundary, and parts of the same farm that overlap each other.
- **Overlaps between farms:**
  - an overlap's percentage is the area shared by two farms divided by the area of the smaller one;
  - it is reported only when it is above the overlap threshold;
  - it is graded HIGH above 80%, and MEDIUM otherwise;
  - farms that only share an edge or a vertex don't overlap, and neither does a farm inside another's hole;
  - a farm given as a point takes part as a circle with its declared area.
- **The result:** a farm with any of these problems is marked as not valid.

#### Scenario: Overlap rule stated

- **WHEN** a user reads the validation section
- **THEN** it states that the overlap percentage is measured against the smaller farm, that it is reported above the deployment's overlap threshold, and that it is graded HIGH above 80%

#### Scenario: Invalid geometries listed

- **WHEN** a user reads the validation section
- **THEN** it names each geometry problem that makes a farm invalid and shows an example image of an overlap, a self-intersection and a polygon with too few points

### Requirement: The area section explains how a farm is measured

The farm area section SHALL explain that:

- a farm's area is measured on the Earth's ellipsoid (WGS84), with no map projection, and is shown in hectares;
- a hole's area is subtracted, and the areas of a farm's several parts are added;
- a farm given as a point has the area declared for it, taken as a circle centred on the point;
- this area is the one shown in the app and the one overlaps are measured against, and it decides whether a farm can be analysed for deforestation;
- the deforestation percentage does not divide by this area: its numerator and denominator are both measured on the map layer, in the layer's coordinates.

#### Scenario: Holes and parts

- **WHEN** a user reads the area section
- **THEN** it states that holes are subtracted and parts are added

#### Scenario: Farm given as a point

- **WHEN** a user reads the area section
- **THEN** it states that a point farm is treated as a circle with its declared area

### Requirement: The deforestation section explains the percentage

The deforestation section SHALL explain:

- **The percentage:** the share of the farm's area that lies on the layer's loss pixels, written as a plain-text formula, with both areas measured on the layer rather than with the area shown in the app.
- **Partial pixels:** a pixel the farm covers only in part counts by that part alone.
- **A worked example:** a 1 ha farm on 30 m pixels, with two loss pixels inside it and a third on its edge, giving 21%.
- **The threshold:** a farm is flagged when its percentage is above the deforestation threshold.
- **No result:** a farm gets no percentage when its polygon is empty, invalid or has no area, when it lies outside the layer, or when the layer can't be read.
- **The limit of the method:** the precision stops at the layer's pixel, since a loss pixel is taken as lost forest as a whole.

#### Scenario: Partial pixel

- **WHEN** a user reads the deforestation section
- **THEN** it states that a loss pixel the farm only partly covers adds only the part inside the farm, and it includes the 1 ha example

#### Scenario: Farm with no result

- **WHEN** a user reads the deforestation section
- **THEN** it lists the cases in which a farm gets no percentage

### Requirement: The page shows the deployment's thresholds

Wherever the page mentions the overlap threshold or the deforestation threshold, it SHALL show the values the web loaded from `GET /config`, formatted as a percentage in the page's language with the threshold's own decimal places. The thresholds SHALL NOT be written into the page's text. The Spanish and English content SHALL use the same placeholders, and no placeholder SHALL be left unreplaced in the rendered page.

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
- **THEN** both have the same three sections and use the same placeholders, and every placeholder is a known one

### Requirement: The header links to the documentation

The header SHALL show a button with a book icon immediately before the language selector, on every page: the landing page, the home, the modules, the documentation page and the admin pages. Hovering or focusing it SHALL show the tooltip "Documentación" in Spanish and "Documentation" in English, and the same text SHALL be its accessible name. Activating it SHALL open the documentation page in the current language. While the documentation page is open, the button SHALL be shown as active.

#### Scenario: From the landing page

- **WHEN** a user on the landing page, with no country selected, clicks the book button
- **THEN** `/documentation` opens

#### Scenario: From an admin page in English

- **WHEN** a user on `/en/admin` clicks the book button
- **THEN** `/en/documentation` opens

#### Scenario: Tooltip

- **WHEN** a user hovers over the book button in Spanish
- **THEN** a tooltip reads "Documentación"

#### Scenario: Switching language on the page

- **WHEN** a user on `/documentation#area` switches the language to English
- **THEN** `/en/documentation` opens, with the content in English

### Requirement: The page and the technical documentation point to each other

Each section of the page SHALL end with a link to its technical document in the repository, on the `dev` branch:

- validation → the polygon-validation section of the API's README;
- area → `docs/polygon_area_calculation.md`;
- deforestation → `docs/deforestation_calculation.md`.

`docs/polygon_area_calculation.md` SHALL contain the technical explanation of the farm area. The repository's technical documents SHALL name the page's Markdown files as the user-facing version that must be updated along with them.

#### Scenario: Link to the technical detail

- **WHEN** a user reaches the end of the deforestation section
- **THEN** a link opens `docs/deforestation_calculation.md` in the repository

#### Scenario: Area document no longer empty

- **WHEN** a developer opens `docs/polygon_area_calculation.md`
- **THEN** it explains how a farm's area is computed (geodesic area on WGS84, holes and parts, point farms)

