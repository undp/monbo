## MODIFIED Requirements

### Requirement: Change detection decides which package jobs run

A single workflow (`.github/workflows/ci.yml`) SHALL hold the API job, the frontend job, and a change-detection job that runs first. Change detection SHALL classify every file of the pull request against its base branch, not only the latest push:

- a path under `apps/api/` SHALL select the API job;
- a path under `apps/web/` SHALL select the frontend job;
- `apps/api/openapi.json` SHALL select both jobs, because the frontend's generated types derive from it;
- a path under `apps/web/public/files/` SHALL select both jobs, because the API's regression suite validates the web's upload templates;
- a change to the CI workflow file SHALL select both.

The package jobs SHALL be skipped through their job-level condition when they are not selected. The workflow SHALL NOT use a workflow-level `paths` filter. Detection SHALL fail open:

- if the detection job fails, both package jobs SHALL run;
- if the pull request's file list cannot be read in full, both package jobs SHALL run.

Detection SHALL NOT depend on third-party actions and SHALL run with read-only permissions.

#### Scenario: Docs-only pull request

- **WHEN** a ready-for-review pull request into `dev` changes only files under `docs/`
- **THEN** both package jobs are skipped by their condition
- **AND** both required checks count as passed, and the pull request can be merged

#### Scenario: API-only pull request

- **WHEN** a pull request changes only files under `apps/api/`
- **THEN** "Test and static checks" runs and "Type-check, lint, build" is skipped

#### Scenario: Frontend-only pull request

- **WHEN** a pull request changes only files under `apps/web/`
- **THEN** "Type-check, lint, build" runs and "Test and static checks" is skipped

#### Scenario: Workflow change runs everything

- **WHEN** a pull request changes `.github/workflows/ci.yml`
- **THEN** both package jobs run

#### Scenario: Later push widens the scope

- **WHEN** a pull request that only changed docs receives a push that changes `apps/api/`
- **THEN** the run for that push runs "Test and static checks"

#### Scenario: Detection failure never skips tests

- **WHEN** the change-detection job fails, or the pull request has more files than the API can list
- **THEN** both package jobs run

#### Scenario: Contract change runs the frontend too

- **WHEN** a pull request changes `apps/api/openapi.json`
- **THEN** both "Test and static checks" and "Type-check, lint, build" run

#### Scenario: Upload template change runs the API too

- **WHEN** a pull request changes only a file under `apps/web/public/files/`
- **THEN** both package jobs run

