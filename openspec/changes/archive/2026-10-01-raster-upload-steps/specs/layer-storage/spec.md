## MODIFIED Requirements

### Requirement: Backward-compatible index entries

Each index entry SHALL support the optional fields `enabled` (boolean) and `version` (non-negative integer: 0 for a layer that has never had a raster). Entries without `enabled` SHALL be treated as enabled. Entries without `version` SHALL be treated as version 1. Existing index files SHALL load without migration.

#### Scenario: Legacy index loads

- **WHEN** `index.json` contains entries without `enabled` or `version`
- **THEN** those layers are treated as enabled with version 1
