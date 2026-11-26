## ADDED Requirements

### Requirement: The contract documents the default category

The OpenAPI description of every response field that carries a layer's category (`categoryId` in
`GET /maps`, `category_id` in `GET /admin/layers`) SHALL state that a layer whose index entry has
no category belongs to the built-in `deforestation` category, which every country has. The web
SHALL NOT keep its own copy of that id.

#### Scenario: Reading the public contract

- **WHEN** a client reads the `categoryId` field of `BaseMapData` in `apps/api/openapi.json`
- **THEN** its description names `deforestation` as the category of a layer without one

#### Scenario: Reading the admin contract

- **WHEN** a client reads the `category_id` field of `AdminLayer` in `apps/api/openapi.json`
- **THEN** its description names `deforestation` as the category of a layer without one

#### Scenario: No hand-written copy in the web

- **WHEN** the web's sources are searched for a constant holding the built-in category id
- **THEN** none exists outside the generated `src/api/schema.d.ts` and the tests' fixtures
