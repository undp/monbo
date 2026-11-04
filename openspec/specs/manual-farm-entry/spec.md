# manual-farm-entry Specification

## Purpose
How a user adds a farm without a file, on the upload step: drawing its polygon or placing its point on a satellite map, filling in its data, and editing it before the upload.
## Requirements
### Requirement: A farm can be added manually

The upload step SHALL have an "Add manually" button. It SHALL open a modal with a satellite map and the farm's fields. The fields are those of the template:
- **mandatory:** producer name, production date, production quantity, its unit and crop type;
- **optional:** ID, region, association, and up to 3 documents.

Pressing "Add" SHALL validate the fields as the template's rows are validated, and SHALL add the farm to the upload list. The modal SHALL keep the entered values only until it is closed.

#### Scenario: Adding a drawn farm

- **WHEN** the user draws a polygon, fills in the mandatory fields and presses "Add"
- **THEN** the modal closes and the farm appears in the upload list

#### Scenario: Missing data

- **WHEN** the user presses "Add" without a crop type
- **THEN** the farm is not added, and the field is marked as mandatory

### Requirement: The farm is drawn on the map

The map SHALL let the user draw either one polygon, vertex by vertex, or one point. A point farm SHALL also need its area in hectares. Once drawn, the user SHALL be able to move a vertex, delete one, and start over. A polygon whose edges cross SHALL NOT be accepted. The map SHALL open centred on the selected country, and the user SHALL be able to move it to a latitude and longitude typed in. The user SHALL also be able to add a vertex, or place the point, at a latitude and longitude typed in, with "Add point"; a typed vertex SHALL follow the same rules as a clicked one. "Add" SHALL be disabled until there is a polygon or a point.

#### Scenario: A point farm

- **WHEN** the user places a point and enters 2.5 ha
- **THEN** the farm is added as a point with that area

#### Scenario: Going to the farm's coordinates

- **WHEN** the user types a latitude and longitude
- **THEN** the map moves there, so the farm can be drawn over the satellite image

#### Scenario: A vertex at known coordinates

- **WHEN** the user types a latitude and longitude and presses "Add point" while drawing a polygon
- **THEN** a vertex is added there, the map moves to it, and the fields empty for the next one

#### Scenario: Crossing edges

- **WHEN** the user draws a vertex that makes the polygon's edges cross
- **THEN** the vertex is not accepted

### Requirement: The modal lists the drawing's coordinates

Below the map, the modal SHALL list the latitude and longitude of each of the polygon's vertices, numbered in drawing order, or of the point's centre, and SHALL update the list as the drawing changes. Once the polygon is closed, choosing a vertex in the list SHALL select it on the map, as a click on the vertex does.

#### Scenario: Reading the vertices

- **WHEN** the user clicks on the map to add a vertex, or drags one
- **THEN** the list shows that vertex's latitude and longitude

#### Scenario: Selecting a vertex from the list

- **WHEN** the polygon is closed and the user chooses its second vertex in the list
- **THEN** the vertex is selected on the map, and "Delete vertex" deletes it

### Requirement: The modal shows how to draw

The modal's drawing toolbar SHALL have a "How to draw?" button, with an information icon. It SHALL open a larger dialog with a short animation, in the user's language, of a polygon being drawn (clicks on the map, then "Close polygon"), and the steps written out. The animation SHALL NOT cover the map.

#### Scenario: Asking how to draw

- **WHEN** the user presses "How to draw?" in the modal
- **THEN** a dialog shows the animation large, with the steps, and closing it returns to the drawing

### Requirement: Manual farms can be edited before the upload

A manual farm in the upload list SHALL be editable: opening it SHALL show the modal with its geometry and its data, and saving SHALL replace it in the list. It SHALL also be removable.

#### Scenario: Fixing a drawn farm

- **WHEN** the user opens a manual farm from the list, moves a vertex and saves
- **THEN** the list keeps one farm, with the new geometry

