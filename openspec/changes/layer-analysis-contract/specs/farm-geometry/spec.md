## MODIFIED Requirements

### Requirement: A farm's geometry survives the round trip

When the web sends a farm back to the API, to `POST /polygons_validation/validate`, `POST /layer_analysis/analyze` or `/generate-image`, the API SHALL rebuild the same geometry: every part and every hole. Its area and its analysis SHALL NOT change because of the round trip.

#### Scenario: Farm with a hole sent to the analysis

- **WHEN** a farm with a hole, as returned by `/farms/parse`, is sent to `/layer_analysis/analyze`
- **THEN** the polygon analysed has that hole, and loss pixels inside the hole don't count
