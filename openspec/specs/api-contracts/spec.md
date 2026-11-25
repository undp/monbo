# api-contracts Specification

## Purpose
The API's request and response shapes are defined once, in its Pydantic models. Their OpenAPI document is committed, the web's types are generated from it, and CI keeps both files current, so the two apps can't drift apart.
## Requirements
### Requirement: The API's OpenAPI is the committed source of contracts

The API's OpenAPI document, including the admin routes whether or not the admin is enabled, SHALL be committed as `apps/api/openapi.json`. It SHALL be produced by `uv run python -m app.openapi`, deterministically (sorted keys, stable formatting), so that the same models always produce the same file. Every JSON route SHALL declare its response model, so its response appears in the document. Response schemas SHALL describe what the API actually returns: every field a response always includes is required, a field is nullable only when the API can return `null`, and a field whose kind depends on a `type` is a union discriminated by it.

#### Scenario: Export is deterministic

- **WHEN** the export runs twice without model changes
- **THEN** `apps/api/openapi.json` is byte-for-byte identical

#### Scenario: Defaulted response fields are required

- **WHEN** a response model has a field with a default, such as an ingestion job's `warnings`
- **THEN** the field is required in the document, because the response always includes it

#### Scenario: Admin contracts included

- **WHEN** the export runs with the admin disabled in the environment
- **THEN** the document still contains the `/admin` paths and their schemas, including the ingestion job

### Requirement: Web API types are generated, not written by hand

The web's types for API requests and responses SHALL be generated from `apps/api/openapi.json` with a pinned version of `openapi-typescript` into `apps/web/src/api/schema.d.ts`, which is committed. The web SHALL NOT declare its own copies of API shapes. Its interface files MAY re-export generated types under the names the code uses, and MAY declare purely frontend types.

#### Scenario: A new API field reaches the web

- **WHEN** a field is added to a Pydantic response model and the contracts are regenerated
- **THEN** the field appears in `schema.d.ts` and in the web's corresponding type, with no hand edit

#### Scenario: Nullable fields are honoured

- **WHEN** the API declares a response field as nullable, such as a farm's deforestation `value` when there is no data
- **THEN** the web's type allows `null`, and the code that reads it handles that case

### Requirement: Contracts can't go stale

CI SHALL fail when `apps/api/openapi.json` doesn't match the current models, and when `apps/web/src/api/schema.d.ts` doesn't match `openapi.json`. A root `pnpm contracts` script SHALL regenerate both.

#### Scenario: Model changed without regenerating

- **WHEN** a pull request changes a Pydantic response model but not `openapi.json`
- **THEN** "Test and static checks" fails and says to run `pnpm contracts`

#### Scenario: OpenAPI changed without regenerating the types

- **WHEN** a pull request changes `openapi.json` but not `schema.d.ts`
- **THEN** "Tests, type-check, lint, build" fails

