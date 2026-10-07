## ADDED Requirements

### Requirement: Admin contracts generated from the API

The admin request and response models SHALL be defined as Pydantic models in the API, including the ingestion job and the upload and cancel responses, and SHALL be declared as the routes' response models. The frontend's admin types SHALL be generated from the API's OpenAPI (`api-contracts`), never written by hand. The public `MapData` type SHALL expose `version` and `pixelSize`, so the frontend can invalidate analysis results when a raster or its calculation metadata changes.

#### Scenario: Contract parity

- **WHEN** a field is added to or removed from an admin Pydantic model and the contracts are regenerated
- **THEN** the frontend's admin type changes accordingly with no hand edit, and the compiler flags any code that relied on the old shape

#### Scenario: Ingestion job typed from the API

- **WHEN** the frontend polls `GET /admin/jobs/{jobId}`
- **THEN** the response's type comes from the API's `IngestionJob` model

## REMOVED Requirements

### Requirement: Contracts mirrored between API and frontend

**Reason**: Hand-mirrored TypeScript interfaces had already drifted from the Pydantic models (nullability, the ingestion job only described on the frontend). They are replaced by types generated from the API's OpenAPI.

**Migration**: See "Admin contracts generated from the API" and the `api-contracts` capability. Run `pnpm contracts` after changing a Pydantic model; the frontend's types follow.
