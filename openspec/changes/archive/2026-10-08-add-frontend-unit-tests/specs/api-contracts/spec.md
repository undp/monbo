## MODIFIED Requirements

### Requirement: Contracts can't go stale

CI SHALL fail when `apps/api/openapi.json` doesn't match the current models, and when `apps/web/src/api/schema.d.ts` doesn't match `openapi.json`. A root `pnpm contracts` script SHALL regenerate both.

#### Scenario: Model changed without regenerating

- **WHEN** a pull request changes a Pydantic response model but not `openapi.json`
- **THEN** "Test and static checks" fails and says to run `pnpm contracts`

#### Scenario: OpenAPI changed without regenerating the types

- **WHEN** a pull request changes `openapi.json` but not `schema.d.ts`
- **THEN** "Tests, type-check, lint, build" fails
