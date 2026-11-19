## ADDED Requirements

### Requirement: One table of every farm with its status

The stage 1 results page (`/polygons-validation`) SHALL show every validated farm in one table, one row per farm, in upload order. It SHALL NOT split them into tabs. The columns SHALL be:
- ID;
- Productor;
- Cultivo;
- Producción, with its unit;
- Área, in hectares, from the parsed farm;
- Tipo (polygon or point);
- Origen;
- Estado.

A farm whose area could not be computed SHALL show "—" as its area, never a number. The page's search SHALL filter the table by ID, producer and crop. The KPI cards, the downloads and the next-stage card SHALL stay as they are. The design is the Etapa 1 results screen of mockup v2, without its "Nombre" column.

#### Scenario: Ready and overlapping farms together

- **WHEN** a validation returns 8 `VALID` farms and 2 farms that overlap each other
- **THEN** the table has 10 rows, in upload order, and no tabs

#### Scenario: A polygon without area

- **WHEN** a farm's polygon is empty, so its area is null
- **THEN** its Área cell shows "—"

#### Scenario: Searching

- **WHEN** the user types a producer's name in the search
- **THEN** only that producer's farms stay in the table

### Requirement: The status says what the farm needs

The Estado column SHALL show one status per farm, chosen in this order:
1. **a geometry error:** the farm has an `invalid_geometry` or `empty_polygon` inconsistency. The status SHALL say the error in words (for example, that the polygon crosses itself) and offer "Revisar".
2. **"Validado manualmente":** the farm's status is `VALID_MANUALLY`. It SHALL offer "Revisar", to undo it.
3. **an overlap:** the farm is `NOT_VALID` with at least one `overlap`. With one neighbour, the status SHALL say "Se superpone con <neighbour ID> (<area>)", with the overlap's area in hectares. With more, it SHALL say "Se superpone con <N> polígonos". It SHALL offer "Revisar".
4. **"Listo":** any other farm. It SHALL offer no "Revisar".

Pressing a row outside "Revisar" SHALL open the farm's detail, as today.

#### Scenario: One neighbour

- **WHEN** CO-003 overlaps only CO-006, by 0.12 ha
- **THEN** CO-003's status reads "Se superpone con CO-006 (0,12 ha)", with "Revisar"

#### Scenario: Two neighbours

- **WHEN** CO-007 overlaps CO-002 and CO-009
- **THEN** CO-007's status reads "Se superpone con 2 polígonos", with "Revisar"

#### Scenario: A self-crossing polygon

- **WHEN** CO-005 has an `invalid_geometry` inconsistency for a self-intersection
- **THEN** its status names the self-intersection, with "Revisar"

#### Scenario: A ready farm

- **WHEN** a farm is `VALID`
- **THEN** its status is "Listo" and it offers no "Revisar"

### Requirement: Reviewing a farm's overlaps

"Revisar" on an overlapping farm, or on a farm validated manually, SHALL open one modal for that farm, listing **every** overlap it has. The modal SHALL show:
- a map with the farm, each neighbour and each overlapping area;
- one line per neighbour, with the neighbour's ID, the overlap's area and percentage, and its criticality;
- one control that validates the farm manually.

Checking the control SHALL set the farm's status to `VALID_MANUALLY`, and its row SHALL then read "Validado manualmente". Unchecking it SHALL set the farm back to `NOT_VALID`. The control SHALL change only that farm: a neighbour is validated from its own row. The status SHALL change in the browser's flow state only, as today.

#### Scenario: Validating a farm with two neighbours

- **WHEN** the user opens "Revisar" on CO-007, which overlaps CO-002 and CO-009, and checks the control
- **THEN** the modal lists both overlaps, CO-007 reads "Validado manualmente", and CO-002 and CO-009 keep their own status

#### Scenario: Undoing a manual validation

- **WHEN** the user opens "Revisar" on a farm validated manually and unchecks the control
- **THEN** the farm reads "Se superpone con …" again

### Requirement: A geometry error can't be validated manually

"Revisar" on a farm with a geometry error SHALL open the informational modal of today, with the polygon and the reason. That modal SHALL NOT offer manual validation, since such a polygon can't be analysed. When a farm has both a geometry error and an overlap, the geometry error SHALL decide its status.

#### Scenario: Reviewing an empty polygon

- **WHEN** the user opens "Revisar" on a farm with an `empty_polygon` inconsistency
- **THEN** the modal explains the problem and has no control to validate the farm

### Requirement: Adding more polygons after a validation

The results page SHALL offer "Agregar más polígonos". It SHALL go to `/polygons-validation/upload-data` with the upload list as the user last left it, including the rows they deleted. The page SHALL NOT validate again until the user presses its button. Pressing it SHALL parse and validate every farm in the list together, old and new, because a new polygon can overlap an old one. The new validation SHALL drop the stage 2 results, as uploading new farms does today.

#### Scenario: Adding a drawn farm

- **WHEN** the user validated an Excel of 10 farms, presses "Agregar más polígonos", draws one farm and presses the button
- **THEN** the list shows the Excel's 10 farms and the drawn one before the button is pressed, and the results show 11 farms afterwards

#### Scenario: Going back without changes

- **WHEN** the user presses "Agregar más polígonos" and leaves the upload page without pressing its button
- **THEN** the earlier results stay as they were

### Requirement: Manual validations survive a new validation only for the same overlaps

After a new validation from "Agregar más polígonos", a farm that was `VALID_MANUALLY` SHALL stay `VALID_MANUALLY` only when all of these hold:
- it has the same ID;
- it has no geometry error;
- it overlaps exactly the same set of farm IDs as when it was validated.

Otherwise it SHALL take the status the API returned, so nobody is validated without having seen each of their overlaps. When a manual validation was dropped, the page SHALL say how many were dropped and why.

#### Scenario: A new farm away from the validated ones

- **WHEN** CO-003 was validated manually over CO-006, and the user adds a farm that overlaps neither
- **THEN** CO-003 still reads "Validado manualmente"

#### Scenario: A new farm on top of a validated one

- **WHEN** CO-003 was validated manually over CO-006, and the user adds CO-020, which overlaps CO-003
- **THEN** CO-003 reads "Se superpone con 2 polígonos", and a notice says 1 manual validation was dropped because of new overlaps

#### Scenario: The neighbour was deleted

- **WHEN** CO-003 was validated manually over CO-006, and the user deletes CO-006 from the list and validates again
- **THEN** CO-003 takes the API's status, `VALID`, and reads "Listo"

### Requirement: The results texts are translated

Every text of the results table, its statuses and the overlap modal SHALL exist in Spanish and English.

#### Scenario: English results

- **WHEN** the user views the results in English
- **THEN** the columns, statuses, "Revisar" and "Agregar más polígonos" are in English
