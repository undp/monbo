## MODIFIED Requirements

### Requirement: Each way to upload has its own card

The step SHALL show the four ways to add farms side by side, as methods to choose from, in this order:
1. the Excel template with coordinates;
2. a geo file with the farms' data;
3. a geo file plus an Excel joined by ID;
4. drawing on the map.

Each method SHALL show an icon, its title and when to use it. One method SHALL be selected at a time, the Excel template first; choosing another one SHALL NOT drop what is already listed. The methods SHALL NOT be numbered, since they are alternatives and not steps; a line under the section's title SHALL say that one is chosen and several can be used. Methods 2 and 3 SHALL name their input the same way ("geo file") and list the geo file extensions in the same order. A method whose farms are in the list SHALL show how many it loaded.

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
