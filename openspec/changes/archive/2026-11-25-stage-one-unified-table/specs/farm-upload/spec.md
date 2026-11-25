## MODIFIED Requirements

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

## ADDED Requirements

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

### Requirement: The stage 1 list is kept while the user visits the results

The upload list of `/polygons-validation/upload-data` SHALL be kept in the flow's browser state. It SHALL hold its sources, the deleted rows and the manual farms. Going to the results and back SHALL show the same list. Nothing about it SHALL be stored on the server. A refresh, starting over or uploading farms on the stage 2 upload page SHALL clear it. Stage 2's own upload list is not kept.

#### Scenario: Back from the results

- **WHEN** the user validates an Excel and a drawn farm, then opens the upload page from "Agregar más polígonos"
- **THEN** the list shows the Excel's farms and the drawn farm, and no validation runs until the user presses the button

#### Scenario: Farms uploaded on stage 2

- **WHEN** the user uploads a new file on the stage 2 upload page and then opens the stage 1 upload page
- **THEN** the stage 1 list is empty, and the page validates the stage 2 farms and goes to the results, as it does today
