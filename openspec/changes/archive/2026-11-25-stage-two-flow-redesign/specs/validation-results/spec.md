## MODIFIED Requirements

### Requirement: Adding more polygons after a validation

The results page SHALL offer "Agregar más polígonos" when the farms were parsed from the flow's
upload list, whichever stage they were uploaded on, also when the list was emptied since. It SHALL go to `/polygons-validation/upload-data` with the upload
list as the user last left it, including the rows they deleted. The page SHALL NOT validate again
until the user presses its button. Pressing it SHALL parse and validate every farm in the list
together, old and new, because a new polygon can overlap an old one. The new validation SHALL drop
the stage 2 results, as uploading new farms does.

#### Scenario: Adding a drawn farm

- **WHEN** the user validated an Excel of 10 farms, presses "Agregar más polígonos", draws one farm
  and presses the button
- **THEN** the list shows the Excel's 10 farms and the drawn one before the button is pressed, and
  the results show 11 farms afterwards

#### Scenario: Farms uploaded on stage 2

- **WHEN** the user uploaded an Excel on stage 2, then validated it on stage 1, and presses
  "Agregar más polígonos" on the results
- **THEN** the upload page lists the Excel's farms

#### Scenario: Going back without changes

- **WHEN** the user presses "Agregar más polígonos" and leaves the upload page without pressing its
  button
- **THEN** the earlier results stay as they were
