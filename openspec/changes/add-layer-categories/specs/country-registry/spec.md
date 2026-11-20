## MODIFIED Requirements

### Requirement: Public list of countries

`GET /countries` SHALL return the countries that are enabled in the registry and have at least one layer that `GET /maps` lists (enabled, with a category that resolves and is enabled), as a list of objects with a `code` field, sorted by code. It SHALL NOT require authentication.

#### Scenario: Current countries

- **WHEN** CO, CR, and EC each have at least one enabled layer
- **THEN** `GET /countries` returns `[{"code": "CO"}, {"code": "CR"}, {"code": "EC"}]`

#### Scenario: New country without published layers

- **WHEN** PE was just added and has no enabled layer
- **THEN** `GET /countries` does not include PE

#### Scenario: Country published

- **WHEN** PE's admin uploads a raster and enables the layer
- **THEN** `GET /countries` includes PE

#### Scenario: Only layers with a broken or disabled category

- **WHEN** PE's only enabled layer has `category_id: "frontier"`, and PE's `frontier` category is disabled or doesn't exist
- **THEN** `GET /countries` does not include PE
