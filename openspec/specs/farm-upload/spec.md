# farm-upload Specification

## Purpose
How farms are uploaded in "Polygon validation" and "Deforestation analysis". There is one card per way to add them: the Excel template, a geo file with the data, a geo file joined to an Excel by ID, and drawing on the map. They feed one list, which the user reviews and sends. The specification also covers how the upload's problems are reported, so that they stay readable and say what to do.
## Requirements
### Requirement: Upload errors are summarized

When an uploaded farms file has validation errors, in "Polygon validation" or in "Deforestation analysis", the web SHALL show at most 5 error notices, one per error in file order. When there are more, it SHALL add one notice saying how many other errors there are, in the user's language. The upload SHALL still stop on any error, as today.

#### Scenario: Few errors

- **WHEN** the uploaded file has 3 rows with errors
- **THEN** 3 error notices are shown, one per row, and no summary notice

#### Scenario: Many errors

- **WHEN** the uploaded file has 1000 rows missing a mandatory column
- **THEN** 5 error notices are shown for the first 5 rows, plus one notice saying there are 995 more errors, and the page stays responsive

### Requirement: The upload is a list of farms from several sources

The upload step of "Polygon validation" and "Deforestation analysis" SHALL build one list of farms from any mix of sources: Excel files, geo files (each one with or without an Excel joined to it), and farms added manually.

The list SHALL show **one row per farm**, in list order. The columns SHALL be ID, Productor, Cultivo, Producción (with its unit), Tipo (polygon or point) and Origen. A farm without an ID SHALL show "—". The area SHALL NOT be shown before the validation, since the API computes it. Every row SHALL have a delete button. A manual farm's row SHALL also have its edit button. Above the rows, the list SHALL show a notice for each file with problems or actions, as the summary requirement says. A long list SHALL scroll inside its section, so the step's button stays reachable.

Deleting a row SHALL remove only that farm. Removing a file from its notice SHALL remove all its rows. A row deleted from a file SHALL stay deleted when the file is read again, for example after the country changes. A file left with no rows SHALL leave the list.

The processing SHALL start only when the user presses the step's button: all the listed farms are then sent together, in list order, as one upload. The button SHALL be disabled while the list is empty.

A file's farms are checked against the country selected when it is read. If the user changes the country while the list has files, the step SHALL read them again against the new country, so a file with farms in another country stops being uploadable. Manual farms SHALL stay as they are. A source the user edits while the files are being read again SHALL keep the edit, for example an Excel detached, a manual farm saved or removed, or a row deleted. An edited file SHALL still be checked against the new country before the list can be uploaded.

#### Scenario: A file and two drawn farms

- **WHEN** the user drops a KMZ of 12 farms and adds 2 farms manually
- **THEN** the list shows 14 rows, 12 with the KMZ as their origin and 2 drawn ones, and pressing the button validates the 14 farms together

#### Scenario: Dropping a file doesn't start the processing

- **WHEN** the user drops the Excel template
- **THEN** one row per farm appears in the list and nothing is sent until the user presses the button

#### Scenario: Deleting one farm of an Excel

- **WHEN** the user deletes the row of farm F2 from an Excel of 5 farms
- **THEN** the list keeps the other 4 farms of that Excel, and pressing the button sends those 4

#### Scenario: A deleted row stays deleted after the country changes

- **WHEN** the user deletes a row of a geo file and then picks another country in the header
- **THEN** the file is read again against the new country and the deleted row doesn't come back

#### Scenario: Deleting the last row of a file

- **WHEN** the user deletes the only row left of an Excel
- **THEN** the Excel leaves the list, along with its notice

#### Scenario: Removing a source

- **WHEN** the user removes a file from its notice
- **THEN** all its rows leave the list, and the other sources stay

#### Scenario: Duplicate IDs across sources

- **WHEN** two sources contain a farm with the same ID
- **THEN** the upload is rejected with an error naming the ID and both sources

#### Scenario: The country changes after a file is listed

- **WHEN** the user drops a GeoJSON whose farms declare Colombia while Colombia is selected, then picks Costa Rica in the header
- **THEN** the file is listed with the other-country error and the button is disabled, until the user removes it or goes back to Colombia

#### Scenario: The country changes while a file is being read

- **WHEN** the user drops that GeoJSON, or attaches an Excel to a geo file, and picks Costa Rica before the read finishes
- **THEN** the source is listed checked against Costa Rica, with the other-country error

#### Scenario: An Excel removed while the files are being read again

- **WHEN** the user picks Costa Rica with a Colombian geo file and its Excel listed, and removes the Excel while the list is being read again
- **THEN** the geo file stays without its Excel, checked against Costa Rica, and a manual farm saved meanwhile keeps its new data

### Requirement: Each way to upload has its own card

The step SHALL show the four ways to add farms side by side, as methods to choose from, in this order:
1. the Excel template with coordinates;
2. a geo file with the farms' data;
3. a geo file plus an Excel joined by ID;
4. drawing on the map.

Each method SHALL show an icon, its title and when to use it. One method SHALL be selected at a time, the Excel template first. The methods not selected SHALL look muted, like a disabled control (a light gray background, a gray icon and gray texts with at least 4.5:1 contrast), and SHALL stay clickable, taking their usual colors on hover; choosing another one SHALL NOT drop what is already listed. The methods SHALL NOT be numbered, since they are alternatives and not steps; a line under the section's title SHALL say that one is chosen and several can be used. Methods 2 and 3 SHALL name their input the same way ("geo file") and list the geo file extensions in the same order. A method whose farms are in the list SHALL show how many it loaded.

Under the methods, a "how to" panel SHALL show the selected method's steps (at most 3), its downloads and its own upload control:
- method 1: a drop zone for Excel files;
- method 2: a drop zone for geo files (GeoJSON, KML, KMZ, a Shapefile as a `.zip`), and the accepted field names;
- method 3: one drop zone for the geo file and one for its Excel;
- method 4: an "Open map" button that opens the drawing modal.

The "how to upload" lines SHALL be listed in order with a bullet icon and without digits, so they are not read as the flow's stages. The methods section and the list of polygons and points to upload SHALL each show an icon next to their title, and neither SHALL be numbered. An empty list SHALL say that the methods above fill it, and a filled one SHALL offer to remove everything. On stage 1, once the list has something, a bar at the bottom of the page SHALL show how many polygons and points it holds, next to the button that validates them. The design is the Etapa 1 screen of mockup v2.

A drop zone SHALL reject a file of another kind with a message naming, by its title, the method that takes it. The Excel template SHALL be downloadable from methods 1 and 3, so the module's page no longer has a separate "download the template" step. An Excel without coordinates dropped on method 1 SHALL be rejected with a message pointing to method 3. All the methods SHALL add to the same list.

#### Scenario: The options read as alternatives

- **WHEN** the user opens the upload step
- **THEN** a line under the title says a method is chosen and several can be used, and the methods show their titles without numbers

#### Scenario: One method at a time

- **WHEN** the user chooses "Dibujar en el mapa" after uploading an Excel with 3 polygons
- **THEN** the panel shows the drawing steps and the "Open map" button, the Excel's 3 polygons stay listed, and "Plantilla Excel" shows "3 cargados"

#### Scenario: No digits on stage 1

- **WHEN** the user opens `/polygons-validation/upload-data`
- **THEN** the methods section and the list show an icon and a title, and the "how to" lines show bullets instead of 1, 2 and 3

#### Scenario: Excel with coordinates

- **WHEN** the user drops the Excel template with its coordinate columns filled in on method 1
- **THEN** its farms are added to the list, read exactly as today

#### Scenario: A geo file on the Excel method

- **WHEN** the user drops a KMZ on method 1
- **THEN** it is not added, and a message says geo files go in method 2 or method 3

#### Scenario: Excel without coordinates

- **WHEN** the user drops an Excel whose coordinate columns are empty on method 1
- **THEN** it is not added, and a message says to use method 3 with its geo file, or to fill in the coordinates

#### Scenario: Geo file and Excel on method 3

- **WHEN** the user drops a KMZ and its Excel on method 3, in any order
- **THEN** once both are there, they are added to the list as one source, joined by ID

#### Scenario: The selected method stands out

- **WHEN** the user opens the upload step
- **THEN** "Plantilla Excel" has a blue border and tint, the other three methods look muted, and pointing at one of them brings back its usual colors

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

Above the list, the step SHALL say how many farms will be uploaded, how many are polygons and how many points, and how many sources have problems. The count SHALL leave out deleted rows. Each file with problems, or with an action that belongs to the whole file, SHALL have one notice above the rows. The notice SHALL contain:
- the file's name and its first problem, with "Show errors" for the rest;
- "Attach Excel" or "Remove Excel", when the file is a geo file;
- "Remove file".

A file's rows SHALL stay visible while it has problems. The step's button SHALL stay disabled until no file has problems, as today.

#### Scenario: Summary

- **WHEN** the list has an Excel of 5 polygons, a Shapefile of 4 polygons and 1 point, and a KMZ missing data
- **THEN** the summary reads "10 farms: 9 polygons and 1 point · 1 source with problems"

#### Scenario: A geo file missing data

- **WHEN** the user drops a KMZ whose 12 placemarks only have a name
- **THEN** a notice above the rows names the KMZ and its missing data, and offers "Attach Excel" and "Remove file"

#### Scenario: Deleted rows leave the count

- **WHEN** the list has an Excel of 5 polygons and the user deletes 2 of its rows
- **THEN** the summary reads "3 farms: 3 polygons and 0 points"

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

For a listed geo file, the step SHALL offer a second drop zone to attach the production Excel (the option 3 template, or the main one with its coordinate cells empty). With an Excel attached, each farm's geometry SHALL come from the geo file, and its data from the Excel row with the same ID, compared as trimmed text (`1` and `"1"` match). The Excel's ID column SHALL then be mandatory. The geo file's country attribute, under any of the names option 2 accepts, SHALL be checked against the selected country as in option 2. These SHALL be errors:
- an Excel row with coordinates: the Excel SHALL be rejected, since it wouldn't be clear whether the farms are placed by the geo file or by the Excel, and the message SHALL say to use the option 3 template or delete the coordinates, or to upload the Excel alone in the Excel template card if its coordinates are the right ones;
- a feature without an ID;
- duplicate IDs on either side;
- an Excel row without a feature;
- a feature without an Excel row.

#### Scenario: KMZ from Google Earth with its Excel

- **WHEN** the user drops a KMZ whose placemark names are the farm IDs, and attaches the production Excel
- **THEN** every farm is listed with the KMZ's geometry and the Excel's data

#### Scenario: An Excel with coordinates

- **WHEN** the user joins to a KMZ an Excel whose rows have their coordinates filled in
- **THEN** the Excel is rejected with a message saying the farms are placed by the geo file, and the KMZ stays listed so another Excel can be attached

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

### Requirement: Each farm keeps its origin

`POST /farms/parse` SHALL accept an optional `origin` per farm, and SHALL return it unchanged in that farm's `FarmData`. A farm sent without one SHALL come back with `origin` null. The `origin` SHALL hold:
- the upload method: `excel`, `geoFile`, `geoFileWithExcel` or `manual`;
- the file's name, null for a manual farm. A geo file joined to an Excel SHALL name the geo file.

The web SHALL send each farm's origin. It SHALL show it as Origen in the upload list and in the results: the file's name, or "Dibujo" for a manual farm. The API SHALL NOT store the origin or write it to the usage events. A file name longer than 255 characters SHALL be rejected with a 422, like any other body that breaks the model.

#### Scenario: The origin comes back from the parser

- **WHEN** the web sends a farm with `origin` `{"method": "geoFile", "fileName": "fincas.kml"}`
- **THEN** `/farms/parse` returns that farm with the same `origin`, and its Origen reads "fincas.kml"

#### Scenario: A client that doesn't send it

- **WHEN** a farm is sent without `origin`
- **THEN** it is parsed as before, with `origin` null, and its Origen shows "—"

### Requirement: The flow's upload list is kept across its stages

The upload list SHALL belong to the flow, not to a stage: `/polygons-validation/upload-data` and
`/territorial-analysis/upload-data` SHALL show and edit the same list, kept in the flow's browser
state. It SHALL hold its sources, the deleted rows and the manual farms. Going to another page or
stage and back SHALL show the same list. Nothing about it SHALL be stored on the server. A refresh
or starting over SHALL clear it.

Neither upload page SHALL parse or validate the list on entry: stage 1 validates it only when the
user presses "Validar", and stage 2 parses it only when the user presses "Continuar".

#### Scenario: Back from the results

- **WHEN** the user validates an Excel and a drawn farm, then opens the upload page from "Agregar
  más polígonos"
- **THEN** the list shows the Excel's farms and the drawn farm, and no validation runs until the
  user presses the button

#### Scenario: Farms uploaded on stage 2

- **WHEN** the user uploads a file on the stage 2 upload page, presses "Continuar", and then opens
  the stage 1 upload page
- **THEN** the stage 1 list shows the same file's farms, and nothing is validated until the user
  presses "Validar"

#### Scenario: Back to the polygons from the layers

- **WHEN** the user uploaded an Excel and drew a farm on stage 2, pressed "Continuar", and then
  pressed "Ver polígonos" on the layers page
- **THEN** the stage 2 upload page lists the Excel's farms and the drawn farm

### Requirement: Confirming the list keeps the results that still describe it

Stage 2's "Continuar" SHALL compare the upload list with the one the loaded farms were parsed
from. When the list changed, the new farms SHALL replace the earlier ones, and the validation
results and the analysis results of the earlier farms SHALL be dropped. When it didn't change,
"Continuar" SHALL keep the farms, the validation results and the analysis results, and go to the
layers page. Stage 1's "Validar" SHALL always parse and validate the list again, and drop the
analysis results, as it does today.

Emptying the list SHALL NOT drop the loaded farms or their results by itself. While farms are
loaded, both upload pages SHALL keep their bottom bar with an emptied list, saying it is empty,
with the button off until the list has a farm again.

#### Scenario: An unchanged list

- **WHEN** the user analysed the farms of an Excel, opened the stage 2 upload page through "Ver
  polígonos" and pressed "Continuar" without changes
- **THEN** the layers page opens, and stage 2 still has its results

#### Scenario: A row deleted

- **WHEN** the user analysed the farms of an Excel, opened the stage 2 upload page, deleted a row
  and pressed "Continuar"
- **THEN** the layers page opens with one polygon fewer, and the earlier analysis results are
  dropped

#### Scenario: Validating again an unchanged list

- **WHEN** the user analysed the farms of an Excel, opened the stage 1 upload page and pressed
  "Validar" without changes
- **THEN** the farms are validated again and the analysis results are dropped

#### Scenario: The list emptied

- **WHEN** the user analysed the farms of an Excel, opened the stage 2 upload page and pressed
  "Quitar todos"
- **THEN** the bar stays, says the list is empty, and its "Continuar" is off; the farms and their
  results stay until a new list is confirmed

### Requirement: Deleting a row drops its problems

The problems found in one row of a file SHALL belong to that row: an Excel row's validation errors, a geo file feature's problems when its farms are read from its attributes, and a row that declares a country other than the selected one. Deleting the row SHALL drop its problems. A file's problems SHALL be its whole-file problems plus the problems of its rows still in the list. When none is left, the file SHALL stop being marked, SHALL leave the count of sources with problems, and SHALL be uploadable.

A geo file's missing data SHALL count only its features still in the list.

A row's problems SHALL stay dropped when the file is read again, for example after the country changes.

Whole-file problems SHALL stay until the file is removed or fixed: a geo file the API rejected, an Excel without coordinates, and a geo file whose joined Excel was rejected or didn't match it.

#### Scenario: Deleting the row with invalid coordinates

- **WHEN** the user drops an Excel of 3 farms whose row 5 has malformed coordinates, and deletes that row from the list
- **THEN** the Excel's notice and its error leave the list, the summary has no source with problems, and the step's button is enabled for the other 2 farms

#### Scenario: Deleting a row without problems

- **WHEN** the user deletes a valid row of that Excel instead
- **THEN** the Excel is still marked with the error of row 5

#### Scenario: Deleting the features missing data

- **WHEN** the user drops a GeoJSON of 3 features where only feature 2 lacks the producer name, and deletes that feature's row
- **THEN** the GeoJSON is no longer marked as missing data, "Attach Excel" is no longer offered, and its 2 farms can be uploaded

#### Scenario: Deleting the farms of another country

- **WHEN** Colombia is selected and the user drops an Excel whose country column says Peru in one row, and deletes that row
- **THEN** the other-country error leaves the list and the remaining farms can be uploaded

#### Scenario: A deleted row's problem doesn't come back

- **WHEN** the user deletes the row with invalid coordinates and then picks another country in the header
- **THEN** the Excel is read again against the new country and the deleted row's error doesn't come back

