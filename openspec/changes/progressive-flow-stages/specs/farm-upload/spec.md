## MODIFIED Requirements

### Requirement: Each way to upload has its own card

The step SHALL show the four ways to add farms side by side, as cards, in this order:
1. the Excel template with coordinates;
2. a geo file with the farms' data;
3. a geo file plus an Excel joined by ID;
4. drawing on the map.

The cards SHALL NOT be numbered, since they are alternatives and not steps; a line under the step's title SHALL say that any of them can be used, and combined. Cards 2 and 3 SHALL name their input the same way ("geo file", holding farms) and list the geo file extensions in the same order.

Each card SHALL say when to use it and what it needs, list how to upload in at most 3 steps, and hold its own upload control:
- card 1: a drop zone for Excel files;
- card 2: a drop zone for geo files (GeoJSON, KML, KMZ, a Shapefile as a `.zip`);
- card 3: one drop zone for the geo file and one for its Excel;
- card 4: the "Add manually" button.

The "how to upload" lines SHALL be listed in order with a bullet icon and without digits, so they are not read as the flow's stages. The upload step's section and the list of farms to upload SHALL each show an icon next to their title, and neither SHALL be numbered.

A drop zone SHALL reject a file of another kind with a message naming, by its title, the card that takes it. The Excel template SHALL be downloadable from cards 1 and 3, so the module's page no longer has a separate "download the template" step. An Excel without coordinates dropped on card 1 SHALL be rejected with a message pointing to card 3. All the cards SHALL add to the same list.

#### Scenario: The options read as alternatives

- **WHEN** the user opens the upload step
- **THEN** a line under the title says any of the options can be used, and the cards show their titles without numbers

#### Scenario: No digits on stage 1

- **WHEN** the user opens `/polygons-validation/upload-data`
- **THEN** the upload section and the farm list show an icon and a title, and the cards' "how to" lines show bullets instead of 1, 2 and 3

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
