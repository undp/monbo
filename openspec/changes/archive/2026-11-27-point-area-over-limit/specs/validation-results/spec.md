## MODIFIED Requirements

### Requirement: The status says what the farm needs

The Estado column SHALL show one status per farm, chosen in this order:
1. **a geometry error:** the farm has an `invalid_geometry`, `empty_polygon` or `point_area_over_limit` inconsistency. The status SHALL say the error in words (for example, that the polygon crosses itself, or that a point of 5 ha must be declared as a polygon) and offer "Revisar".
2. **"Validado manualmente":** the farm's status is `VALID_MANUALLY`. It SHALL offer "Revisar", to undo it.
3. **an overlap:** the farm is `NOT_VALID` with at least one `overlap`. With one neighbour, the status SHALL say "Se superpone con <neighbour ID>"; the overlap's area is in "Revisar", so the status stays short. With more, it SHALL say "Se superpone con <N> polígonos". It SHALL offer "Revisar".
4. **"Listo":** any other farm. It SHALL offer no "Revisar".

Pressing a row outside "Revisar" SHALL open the farm's detail, as today.

#### Scenario: One neighbour

- **WHEN** CO-003 overlaps only CO-006, by 0.12 ha
- **THEN** CO-003's status reads "Se superpone con CO-006", with "Revisar"

#### Scenario: Two neighbours

- **WHEN** CO-007 overlaps CO-002 and CO-009
- **THEN** CO-007's status reads "Se superpone con 2 polígonos", with "Revisar"

#### Scenario: A self-crossing polygon

- **WHEN** CO-005 has an `invalid_geometry` inconsistency for a self-intersection
- **THEN** its status names the self-intersection, with "Revisar"

#### Scenario: A point over 4 ha

- **WHEN** CO-008 is a point of 5 ha with a `point_area_over_limit` inconsistency
- **THEN** its status reads "Punto de 5 ha: más de 4 ha se declara como polígono", with "Revisar", and "Revisar" offers no manual validation

#### Scenario: A ready farm

- **WHEN** a farm is `VALID`
- **THEN** its status is "Listo" and it offers no "Revisar"
