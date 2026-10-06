## 1. Deploy identity in the platform stack (D1, D2)

- [x] 1.1 `infra/terraform/platform`:
  - `azurerm_user_assigned_identity` `monbo-<env>-deploy` in the platform resource group;
  - `azurerm_federated_identity_credential` with issuer `https://token.actions.githubusercontent.com`, audience `api://AzureADTokenExchange` and subject `repo:undp/monbo:environment:<env>`.
  The repository is a variable with default `undp/monbo`
- [x] 1.2 Role assignments, all with `principal_type = "ServicePrincipal"`:
  - Reader on the subscription (`data.azurerm_subscription`);
  - AcrPush on the registry;
  - Storage Blob Data Contributor on the state account. It is not managed here: use a data source with new variables `state_resource_group_name` (default `monbo-tfstate`) and `state_storage_account_name` (default `monbotfstate`)
- [x] 1.3 Outputs: `deploy_identity_client_id`, `deploy_identity_principal_id`, `tenant_id` (`data.azurerm_client_config`)
- [x] 1.4 `tests/platform.tftest.hcl`:
  - the identity's name;
  - the federated subject and issuer;
  - the three roles and their scopes.
  Then `fmt`, `validate` and `test`

## 2. Scripts under CI (D5)

- [x] 2.1 `infra/lib.sh`:
  - make sure nothing assumes a user login (`select_subscription` with a managed identity);
  - no ANSI colours when `CI` is set, if needed for readability
  - No change needed: GitHub Actions renders ANSI colours, and `select_subscription` only uses `az account show/set`.
- [x] 2.2 `infra/deploy.sh`: when `GITHUB_STEP_SUMMARY` is set, append a summary: environment, tag, URLs, and "deployed" or "rolled back" plus the failed revision's log command. Run shellcheck
- [x] 2.3 Locally, simulate CI without a secrets file: export the same variables, run `infra/deploy.sh dev --plan-only` and check it reads everything from the environment. This doesn't change Azure
  - Done with `TAG=83fa85d --skip-build --plan-only`, the secrets file moved aside, `CI` and `GITHUB_STEP_SUMMARY` set: subscription selected, share checked, plan `No changes`.

## 3. Workflow (D3)

- [x] 3.1 `.github/workflows/deploy.yml`:
  - triggers: push to `dev` with the D3 paths, and `workflow_dispatch` with an optional `tag` input;
  - `permissions: {}`, and on the job `id-token: write` and `contents: read`;
  - `concurrency: deploy-dev`, no cancel;
  - `environment: dev`;
  - steps: checkout (no LFS); `azure/login@a641126d1b8aa4d1fa005f4f92df94a3a4c4c906 # v3.1.0` with client, tenant and subscription from secrets; `hashicorp/setup-terraform` (same pin as `ci.yml`, 1.16.5, `terraform_wrapper: false`);
  - the deploy step with `ARM_USE_OIDC`, `ARM_CLIENT_ID`, `ARM_TENANT_ID`, `ARM_SUBSCRIPTION_ID` and `TF_VAR_*` from secrets, `TAG` set to the input or the short SHA, and `--skip-build` when a tag is given
- [x] 3.2 Run actionlint and shellcheck through Docker. Confirm that Dependabot's `github-actions` entry covers the new file (directory `/`)

## 4. Docs

- [x] 4.1 `docs/suggested_deployment.md`, new section "Continuous deployment":
  - what triggers a deploy and what doesn't;
  - the setup order (D Migration Plan);
  - **the two manual role grants, with the exact commands and a verification command**;
  - the GitHub Environment and its secrets;
  - manual redeploys from the Actions tab;
  - reading a failed run
- [x] 4.2 `infra/README.md`: the CD flow in "The full flow", the deploy identity in the diagram, and "Where each value goes" (GitHub Environment)
- [x] 4.3 Root `README.md`: a deploy bullet in "Continuous Integration". `docs/branch_protection.md`: deploys aren't checks and never block merges
- [x] 4.4 `CHANGELOG.md` Unreleased: merging into `dev` deploys the dev environment

## 5. Rollout (changes Azure and GitHub settings — confirm with the user before each step)

- [x] 5.1 Apply `platform` for `dev`. Expect only additions: the identity, the credential and three role assignments
  - Done on 2026-10-06 from a saved plan: `5 to add, 0 to change, 0 to destroy`. Created `monbo-dev-deploy`, the federated credential `github-dev` (subject `repo:undp/monbo:environment:dev`), Reader on the subscription, AcrPush on `monbodevacr` and Storage Blob Data Contributor on `monbotfstate`.
- [x] 5.2 The unconditional Owner assigns Contributor on `monbo-dev-apps` and Storage Account Key Operator Service Role on `monbodevdata` to `monbo-dev-deploy`. Verify with `az role assignment list --assignee <principalId> --all -o table`
- [x] 5.3 Create the GitHub Environment `dev` (deployment branch policy: `dev` only) and its secrets (`gh api` and `gh secret set --env dev`)
  - Done on 2026-10-06 with `gh`: environment `dev` with a custom branch policy (`branch:dev`). Six secrets were piped through stdin, so no values hit the command line or the logs: `AZURE_CLIENT_ID` and `AZURE_TENANT_ID` (from the platform outputs), and `ARM_SUBSCRIPTION_ID`, `TF_VAR_GCP_MAPS_PLATFORM_API_KEY`, `TF_VAR_GCP_MAPS_PLATFORM_SIGNATURE_SECRET`, `TF_VAR_ADMIN_SESSION_SECRET` (from `dev.secrets.env`). `TF_VAR_FRONT_…` was skipped, being empty; the web app reuses the API key.
  - Done on 2026-10-06. Verified: the deploy identity holds Storage Blob Data Contributor (`monbotfstate`), AcrPush (`monbodevacr`), Reader (subscription), Contributor (`monbo-dev-apps`) and Storage Account Key Operator Service Role (`monbodevdata`).
- [x] 5.4 Commit into #54 (option A, chosen by the user); merge #54 **only after 5.2**. The merge deploys `dev`; check the run and the summary
  - Done on 2026-10-06. #54 was squash-merged as `316206b`, and the merge started the Deploy run on its own. In 4 minutes it checked the share, built and pushed both images tagged `316206b`, recorded `83fa85d` as the rollback target, and applied `0 to add, 2 to change`. Each new revision was ready with the new image, `/health` reported a writable `/mnt/maps`, and the web app was healthy. The GitHub deployment record for `dev` points at `316206b`.
  - Follow-up: the run log showed the subscription's *name* (`select_subscription`); the ids are masked secrets. `infra/lib.sh` no longer prints the name when `CI` is set.
- [ ] 5.5 A docs-only merge doesn't start a deploy run
- [ ] 5.6 `workflow_dispatch` with the current tag redeploys without building, and verifies
- [ ] 5.7 Optional: a deploy that fails rolls back and fails the run. This was already proven locally in terraform-infrastructure 10.3
