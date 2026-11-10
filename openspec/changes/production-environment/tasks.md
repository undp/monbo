## 1. Terraform: per-environment state account (D3)

- [x] 1.1 `infra/terraform/platform/variables.tf`: remove the default of `state_storage_account_name`, with a description saying each environment sets its own in `envs/<env>.tfvars`
- [x] 1.2 `infra/terraform/platform/envs/dev.tfvars`: set `state_storage_account_name = "monbotfstate"` (no-op for `dev`)
- [x] 1.3 `infra/terraform/platform/tests/platform.tftest.hcl`: set `state_storage_account_name` in `variables`. Check that `fmt`, `validate` and `test` pass in both stacks

## 2. Terraform: the prod environment (D6)

- [x] 2.1 `infra/terraform/platform/envs/prod.tfvars`: `env = "prod"`, `location = "eastus2"` (comment: confirm against the subscription's allowed regions), `state_storage_account_name = "monboprodtfstate"`, commented `unique_suffix`
- [x] 2.2 `infra/terraform/platform/envs/prod.backend.hcl` and `infra/terraform/apps/envs/prod.backend.hcl`: `monbo-tfstate` / `monboprodtfstate` / `tfstate`, keys `prod/platform.tfstate` and `prod/apps.tfstate`
- [x] 2.3 `infra/terraform/apps/envs/prod.tfvars`: `env = "prod"`, `state_storage_account_name = "monboprodtfstate"`, the same sizes, thresholds and contact URL as `dev`, `show_testing_environment_warning = false`
- [x] 2.4 `infra/envs/prod.secrets.env.example`, copied from `dev.secrets.env.example` with `prod` in the comments. Check that `.gitignore` covers `infra/envs/prod.secrets.env`
- [x] 2.5 `platform.tftest.hcl`: a run with `env = "prod"` and the prod state account, with `override_data` for the state account. It checks:
  - `monbo-prod-data`, `monbo-prod-platform`, `monboproddata` and `monboprodacr`;
  - the federated subject `repo:undp/monbo:environment:prod`;
  - the state role scoped to `monboprodtfstate`.
- [x] 2.6 `apps.tftest.hcl`: a run with the prod tfvars values, checking that the web app gets the testing banner off
- [x] 2.7 Run `terraform fmt -check -recursive`, then `init -backend=false`, `validate` and `test` in both stacks, with Terraform 1.16.5 as in CI

## 3. Scripts

- [x] 3.1 `infra/bootstrap.sh`: header and messages say "once per state account" instead of "once per subscription". The usage shows `./infra/bootstrap.sh monboprodtfstate` for prod. The non-default-name hint points at `state_storage_account_name` in both stacks' tfvars
- [x] 3.2 Grep `infra/`, `tools/` and `apps/` for anything else assuming `dev` or `monbotfstate` (messages, defaults). Fix only what would mislead for `prod`. Run shellcheck on the changed scripts
  - Only `lib.sh`'s missing-environment message changed (it gave `test` as the example). `deploy.sh` and `layers-ops.sh` only use `dev` in usage examples.

## 4. Workflow (D1, D2)

- [x] 4.1 `.github/workflows/deploy.yml`:
  - `on.push.branches: [dev, main]`, same paths;
  - job `if: github.ref_name != 'main' || vars.DEPLOY_PROD == 'true'`;
  - `environment.name`, `env.ENV_NAME` and `concurrency.group` derived from `github.ref_name == 'main' && 'prod' || 'dev'`, with concurrency moved to the job;
  - job name `Deploy to ${{ … }}`;
  - header comment updated (both environments, the switch, why the expression is repeated);
  - the `workflow_dispatch` input description says the run deploys its branch's environment.
- [x] 4.2 Run actionlint and shellcheck through Docker on `deploy.yml`

## 5. Docs

- [x] 5.1 `docs/suggested_deployment.md`:
  - intro: two environments, `dev` from `dev` and `prod` from `main`;
  - "Creating an environment from nothing": `bootstrap.sh` once per state account, with `prod`'s account name;
  - "Continuous deployment":
    - the trigger table for both branches;
    - `deploy-<env>` concurrency;
    - manual runs per branch;
    - `DEPLOY_PROD`;
  - "How CI authenticates": the commands parametrized by `<env>` (`monbo-<env>-platform`, `monbo-<env>-deploy`, `monbo-<env>-apps`, `monbo<env>data`);
  - "The GitHub Environment `dev`" generalized to `<env>`, with `prod` limited to `main`, and required reviewers as an option.
- [x] 5.2 `docs/suggested_deployment.md`, new section "Production". It covers:
  - what the Azure access must allow:
    - subscription scope;
    - the six roles the operators must be able to assign;
    - the resource providers (`Microsoft.App`, `Microsoft.ContainerRegistry`, `Microsoft.Storage`, `Microsoft.OperationalInsights`, `Microsoft.RecoveryServices`, `Microsoft.ManagedIdentity`);
    - the Azure Policies that would block it (shared-key storage, public network access, regions, tags, federated credentials);
  - the ordered setup procedure (design, Migration Plan), including the main ruleset's check rename before the first release;
  - how to turn production deploys off and roll back.

  No account-specific names.
- [x] 5.3 `infra/README.md`:
  - the state diagram and "full flow" for per-environment state accounts;
  - "Adding an environment" pointing at the prod section;
  - the CI paragraph for both branches.
- [x] 5.4 `docs/architecture.md`: the state account line (one per environment)
- [x] 5.5 Check `docs/branch_protection.md` and the root `README.md` for statements that only `dev` is deployed, and update them

## 6. Verification

- [x] 6.1 `openspec validate production-environment --strict`
- [x] 6.2 With the local `dev` secrets, run `terraform plan` of `platform` with `envs/dev.tfvars`. Expect no changes (the state account is now explicit). Run `infra/deploy.sh dev --plan-only --skip-build` with the current tag. Neither changes Azure
  - Both `No changes`: `platform` with the explicit `monbotfstate`, and `apps` via `deploy.sh dev --plan-only --skip-build` with the tag `dev` serves.
- [ ] 6.3 After merging into `dev`: confirm the push deploys `dev` as before, and the run shows `deploy-dev` and environment `dev`
- [ ] 6.4 After the next release into `main`, with `DEPLOY_PROD` unset: confirm the deploy job is skipped, not failed, and that no `prod` environment was auto-created
