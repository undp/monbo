## ADDED Requirements

### Requirement: Terraform job in the CI workflow

The CI workflow SHALL include a `Terraform` job, selected by change detection when a pull request changes a path under `infra/` or the CI workflow file, and run under the same draft and fail-open rules as the package jobs. It SHALL NOT be a required check unless the rulesets are explicitly changed to require it, and the documentation SHALL state how to add it.

#### Scenario: Infrastructure pull request

- **WHEN** a ready-for-review pull request into `dev` changes `infra/terraform/apps/main.tf`
- **THEN** the `Terraform` job runs, and the package jobs are skipped unless their apps changed too

#### Scenario: Detection failure

- **WHEN** change detection fails
- **THEN** the `Terraform` job runs along with the package jobs
