## ADDED Requirements

### Requirement: The upload is a list of farms from several sources

The upload step of "Polygon validation" and "Deforestation analysis" SHALL build one list of farms from any mix of sources: Excel files, geo files (each one with or without an Excel joined to it), and farms added manually. The list SHALL show each source with its number of farms, and each manual farm on its own. The user SHALL be able to remove any source or manual farm. The processing SHALL start only when the user presses the step's button: all the listed farms are then sent together, in list order, as one upload. The button SHALL be disabled while the list is empty.

#### Scenario: A file and two drawn farms

- **WHEN** the user drops a KMZ of 12 farms and adds 2 farms manually
- **THEN** the list shows the KMZ with 12 farms and both manual farms, and pressing the button validates the 14 farms together

#### Scenario: Dropping a file doesn't start the processing

- **WHEN** the user drops the Excel template
- **THEN** its farms appear in the list and nothing is sent until the user presses the button

#### Scenario: Removing a source

- **WHEN** the user removes a source from the list
- **THEN** its farms leave the list, and the other sources stay

#### Scenario: Duplicate IDs across sources

- **WHEN** two sources contain a farm with the same ID
- **THEN** the upload is rejected with an error naming the ID and both sources

### Requirement: Each way to upload has its own card

The step SHALL show the four ways to add farms side by side, as cards, in this order:
1. the Excel template with coordinates;
2. a geo file with the farms' data;
3. a geo file plus an Excel joined by ID;
4. drawing on the map.

Each card SHALL say when to use it and what it needs, list how to upload in at most 3 steps, and hold its own upload control:
- card 1: a drop zone for Excel files;
- card 2: a drop zone for geo files (GeoJSON, KML, KMZ, a Shapefile as a `.zip`);
- card 3: one drop zone for the geo file and one for its Excel;
- card 4: the "Add manually" button.

A drop zone SHALL reject a file of another kind with a message naming the card that takes it. The Excel template SHALL be downloadable from cards 1 and 3, so the module's page no longer has a separate "download the template" step. An Excel without coordinates dropped on card 1 SHALL be rejected with a message pointing to card 3. All the cards SHALL add to the same list.

#### Scenario: Excel with coordinates

- **WHEN** the user drops the Excel template with its coordinate columns filled in on card 1
- **THEN** its farms are added to the list, read exactly as today

#### Scenario: A geo file on the Excel card

- **WHEN** the user drops a KMZ on card 1
- **THEN** it is not added, and a message says geo files go in card 2 or card 3

#### Scenario: Excel without coordinates

- **WHEN** the user drops an Excel whose coordinate columns are empty on card 1
- **THEN** it is not added, and a message says to use card 3 with its geo file, or to fill in the coordinates

#### Scenario: Geo file and Excel on card 3

- **WHEN** the user drops a KMZ and its Excel on card 3, in any order
- **THEN** once both are there, they are added to the list as one source, joined by ID

### Requirement: Option 3 has its own Excel template

Card 3 SHALL offer a template for the production Excel (es and en) without the coordinate columns, where the ID column is mandatory. It SHALL keep the main template's other columns and headers, so the same reader takes it.

#### Scenario: Downloading the option 3 template

- **WHEN** the user downloads the template from card 3
- **THEN** its headers are the main template's without "Formato coordenadas", "Tipo geometría" and "Coordenadas finca", and its ID column is marked mandatory

### Requirement: Each card has example files

Cards 1 to 3 SHALL offer example files that upload without errors, in the user's language:
- card 1: a filled Excel template;
- card 2: a GeoJSON and a zipped Shapefile, with the accepted attribute names;
- card 3: a KML whose placemark names are the IDs, and its Excel filled in from the option 3 template.

The example farms SHALL NOT carry a producer country, so they upload whatever country is selected.

#### Scenario: Uploading the option 3 examples

- **WHEN** the user downloads both card 3 examples and drops them on card 3
- **THEN** their farms are added to the list without errors

### Requirement: The list summarizes what will be uploaded

Above the list, the step SHALL say how many farms will be uploaded, how many are polygons and how many points, and how many sources have problems. A source with problems SHALL show its first problem in the list, with "Show errors" for the rest.

#### Scenario: Summary

- **WHEN** the list has an Excel of 5 polygons, a Shapefile of 4 polygons and 1 point, and a KMZ missing data
- **THEN** the summary reads "10 farms: 9 polygons and 1 point · 1 source with problems"

### Requirement: Messages say what to do

A source's problem SHALL say what the user can do about it, not only what is wrong:
- **a geo file missing data:** the missing fields and how many features miss them, and that the Excel can be attached with their IDs (option 3), or the attributes added to the file;
- **IDs that don't match between a geo file and its Excel:** how many, and that each feature's ID (or a KML placemark's name) must be its row's ID;
- **an ID in two sources:** to remove or fix one of them.

#### Scenario: A KMZ from Google Earth on card 2

- **WHEN** the user drops on card 2 a KMZ whose 12 placemarks only have a name
- **THEN** the list says that producer name, production date, quantity, unit and crop type are missing in 12 features, and offers to attach the Excel with their IDs

### Requirement: A geo file's farms read their data from fixed attribute names

Each feature of a geo file SHALL be a farm. Without an Excel joined to it, each farm's data SHALL be read from the feature's attributes. The accepted names SHALL be:
- the template's es/en headers;
- the EUDR GeoJSON names (`ProducerName`, `Area`, `ProducerCountry`);
- the names of Monbo's own GeoJSON download;
- short names for Shapefiles, whose field names have at most 10 characters (`ID`, `PRODUCTOR`, `FECHA_PROD`, `CANTIDAD`, `UNIDAD`, `CULTIVO`, `AREA_HA`, `REGION`, `ASOCIACION`, `PAIS`).

Names SHALL be matched ignoring case and surrounding spaces. In a KML or KMZ without an ID attribute, the placemark's name SHALL be the ID. An area of 0 SHALL count as missing. A `ProducerCountry` other than the selected country SHALL be rejected, as the old template's country column. The step SHALL show a help panel with the accepted names.

#### Scenario: Monbo's GeoJSON download uploaded again

- **WHEN** the user drops a GeoJSON downloaded from Monbo
- **THEN** its farms are added to the list with no edits

#### Scenario: Shapefile with short names

- **WHEN** the user drops a `.zip` with a Shapefile of polygons and one of points, with fields `PRODUCTOR`, `FECHA_PROD`, `CANTIDAD`, `UNIDAD` and `CULTIVO`
- **THEN** all its farms are added, points and polygons

#### Scenario: Geo file without the data

- **WHEN** the user drops a KMZ whose placemarks only have a name on card 2
- **THEN** the file is listed as missing data, and the list offers to attach an Excel to it

### Requirement: An Excel can be joined to a geo file by ID

For a listed geo file, the step SHALL offer a second drop zone to attach the production Excel (the template, with its coordinate columns empty or ignored). With an Excel attached, each farm's geometry SHALL come from the geo file, and its data from the Excel row with the same ID, compared as trimmed text (`1` and `"1"` match). The Excel's ID column SHALL then be mandatory. The geo file's country attribute, under any of the names option 2 accepts, SHALL be checked against the selected country as in option 2. These SHALL be errors:
- a feature without an ID;
- duplicate IDs on either side;
- an Excel row without a feature;
- a feature without an Excel row.

#### Scenario: KMZ from Google Earth with its Excel

- **WHEN** the user drops a KMZ whose placemark names are the farm IDs, and attaches the production Excel
- **THEN** every farm is listed with the KMZ's geometry and the Excel's data

#### Scenario: An ID that doesn't match

- **WHEN** the Excel has a row F-050 and the KMZ a placemark F-005
- **THEN** both are reported: the row without a polygon, and the polygon without a row

#### Scenario: A Shapefile's PAIS names another country

- **WHEN** a Shapefile whose features carry `PAIS = CO` is joined to its Excel while Costa Rica is selected
- **THEN** the source is rejected with the other-country error, as a GeoJSON with `ProducerCountry = CO` would be

### Requirement: Upload errors name their source

When the farms of a source can't be read, or the upload is rejected, the errors SHALL say which source and which row, feature or farm they come from, and SHALL still be summarized as at most 5 notices plus a count of the rest.

#### Scenario: Errors in a geo file

- **WHEN** 3 features of `fincas.kmz` miss mandatory data
- **THEN** 3 notices name `fincas.kmz`, the feature and the missing field
