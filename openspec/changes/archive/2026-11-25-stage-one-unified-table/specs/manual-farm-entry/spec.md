## MODIFIED Requirements

### Requirement: A farm can be added manually

The upload step's drawing method SHALL show an area that says "Draw a polygon or mark a point on the map". **The whole area** SHALL open the drawing modal. It SHALL be one control that can be focused and opened with Enter or Space, named by its text for assistive technologies. The modal SHALL show a satellite map and the farm's fields. The fields are those of the template:
- **mandatory:** producer name, production date, production quantity, its unit and crop type;
- **optional:** ID, region, association, and up to 3 documents.

Pressing "Add" SHALL validate the fields as the template's rows are validated, and SHALL add the farm to the upload list. The modal SHALL keep the entered values only until it is closed.

#### Scenario: Opening the map from anywhere in the area

- **WHEN** the user clicks the area's background image, away from its text
- **THEN** the drawing modal opens

#### Scenario: Opening the map with the keyboard

- **WHEN** the user tabs to the drawing area and presses Enter
- **THEN** the drawing modal opens

#### Scenario: Adding a drawn farm

- **WHEN** the user draws a polygon, fills in the mandatory fields and presses "Add"
- **THEN** the modal closes and the farm appears in the upload list

#### Scenario: Missing data

- **WHEN** the user presses "Add" without a crop type
- **THEN** the farm is not added, and the field is marked as mandatory
