## ADDED Requirements

### Requirement: A drawn farm can have holes and several parts

Once the farm has a closed polygon, the drawing toolbar SHALL offer "Add part" and "Add hole". The new ring SHALL be drawn like the first one: clicks on the map or typed vertices with "Add point", then "Close polygon".
- **Assignment:** a hole SHALL belong to the part that contains it. A part SHALL lie outside the other parts, or inside another part's hole.
- **Rules, enforced while drawing:**
  - no ring crosses itself;
  - no two rings touch or cross;
  - every hole lies inside its part's exterior and outside that part's other holes;
  - no part lies inside another part, except inside one of its holes.
- **Edits:** every edit (a vertex added, moved, inserted or deleted, or a ring closed) SHALL be checked against all the rings. An edit that breaks a rule SHALL NOT be accepted, and the modal SHALL say which rule it broke.
- **Deleting a ring:** the user SHALL be able to delete the selected vertex's whole ring: a hole, or a part with its holes. The farm SHALL keep at least one part.
- **The row's geometry:** a GeoJSON `Polygon` whose rings are the exterior and its holes when the farm has one part, and a GeoJSON `MultiPolygon` when it has several.

#### Scenario: A farm with two plots

- **WHEN** the user closes a polygon, presses "Add part", draws a second polygon away from the first and closes it
- **THEN** the farm is added as a MultiPolygon of 2 parts

#### Scenario: A farm that leaves out an area

- **WHEN** the user closes a polygon, presses "Add hole" and draws a ring inside it
- **THEN** the farm is added as a Polygon with that hole, and the map shows the hole empty

#### Scenario: A hole that touches the border

- **WHEN** the user closes a hole whose edge touches or crosses its part's border
- **THEN** the hole is not accepted, and a message says it must lie inside the farm without touching its border

#### Scenario: Overlapping parts

- **WHEN** the user closes a part that overlaps another part
- **THEN** the part is not accepted, and a message says a part can't lie on another one, though it can lie inside a hole

#### Scenario: A plot inside a hole

- **WHEN** the user draws a part inside another part's hole, without touching it
- **THEN** the part is accepted

#### Scenario: An exterior vertex dragged over a hole

- **WHEN** the user drags a part's vertex so that its border crosses one of its holes
- **THEN** the vertex goes back to where it was, and a message says the borders can't touch or cross

#### Scenario: Deleting a hole

- **WHEN** the user selects a vertex of a hole and presses "Delete hole"
- **THEN** the hole is removed and the part stays

## MODIFIED Requirements

### Requirement: The farm is drawn on the map

The map SHALL let the user draw either a polygon farm, vertex by vertex, or one point. A polygon farm MAY have holes and several parts. A point farm SHALL also need its area in hectares. Once drawn, the user SHALL be able to move a vertex, delete one, and start over. A ring whose edges cross SHALL NOT be accepted. The map SHALL open centred on the selected country, and the user SHALL be able to move it to a latitude and longitude typed in. The user SHALL also be able to add a vertex to the ring being drawn, or place the point, at a latitude and longitude typed in, with "Add point"; a typed vertex SHALL follow the same rules as a clicked one. "Add" SHALL be disabled until there is a polygon with no ring left open, or a point; a ring started with "Add hole" or "Add part" counts as left open until it is closed or discarded, even with no vertex yet.

#### Scenario: A point farm

- **WHEN** the user places a point and enters 2.5 ha
- **THEN** the farm is added as a point with that area

#### Scenario: Going to the farm's coordinates

- **WHEN** the user types a latitude and longitude
- **THEN** the map moves there, so the farm can be drawn over the satellite image

#### Scenario: A vertex at known coordinates

- **WHEN** the user types a latitude and longitude and presses "Add point" while drawing a ring
- **THEN** a vertex is added there, the map moves to it, and the fields empty for the next one

#### Scenario: Crossing edges

- **WHEN** the user draws a vertex that makes a ring's edges cross
- **THEN** the vertex is not accepted

#### Scenario: A ring left open

- **WHEN** the user presses "Add hole", marks two vertices and doesn't close the ring, or presses it and marks none
- **THEN** "Add" stays disabled until the ring is closed or discarded, or the drawing starts over

### Requirement: The modal lists the drawing's coordinates

Below the map, the modal SHALL list the latitude and longitude of the farm's vertices, or of the point's centre, and SHALL update the list as the drawing changes. The vertices SHALL be grouped by ring ("Part 1", "Part 1 · Hole 1", "Part 2"…) and numbered within each ring, with the ring being drawn last. Choosing a vertex of a closed ring in the list SHALL select it on the map, as a click on the vertex does.

#### Scenario: Reading the vertices

- **WHEN** the user clicks on the map to add a vertex, or drags one
- **THEN** the list shows that vertex's latitude and longitude, under its ring

#### Scenario: Selecting a vertex from the list

- **WHEN** the polygon is closed and the user chooses its second vertex in the list
- **THEN** the vertex is selected on the map, and "Delete vertex" deletes it

#### Scenario: A farm with a hole and two parts

- **WHEN** the farm has two parts and the first one has a hole
- **THEN** the list shows three groups: "Part 1", "Part 1 · Hole 1" and "Part 2"

### Requirement: The modal shows how to draw

The modal's drawing toolbar SHALL have a "How to draw?" button, with an information icon. It SHALL open a larger dialog with an animation, in the user's language, recorded from the modal itself, and the steps written out in the same order. The animation SHALL show a polygon being drawn (clicks on the map, then "Close polygon") and a vertex dragged, then a hole added inside it with "Add hole", and a second part added with "Add part". The animation SHALL NOT cover the map.

#### Scenario: Asking how to draw

- **WHEN** the user presses "How to draw?" in the modal
- **THEN** a dialog shows the animation large, with the steps, and closing it returns to the drawing

#### Scenario: Learning to add a hole and a part

- **WHEN** the user watches the animation
- **THEN** it shows a hole drawn inside the farm and left empty, and a second part drawn beside it, each closed with "Close polygon"

### Requirement: Manual farms can be edited before the upload

A manual farm in the upload list SHALL be editable: opening it SHALL show the modal with its geometry, including its holes and parts, and its data. Saving SHALL replace it in the list. It SHALL also be removable.

#### Scenario: Fixing a drawn farm

- **WHEN** the user opens a manual farm from the list, moves a vertex and saves
- **THEN** the list keeps one farm, with the new geometry

#### Scenario: Editing a farm with a hole and two parts

- **WHEN** the user opens a manual farm of two parts, one with a hole
- **THEN** the map shows both parts and the hole, and the user can edit any of their vertices
