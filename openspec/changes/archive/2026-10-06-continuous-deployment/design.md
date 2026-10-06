## Context

`infra/deploy.sh <env>` is the only way to deploy the apps. It:

1. reads the `platform` outputs;
2. refuses an unseeded share;
3. builds and pushes both images tagged with the commit;
4. applies the `apps` stack;
5. verifies that each new revision is ready with the new image and that `/health` reads a writable `/mnt/maps`;
6. rolls back both apps when any of that fails.

With `--yes` it never prompts. Secrets and the subscription come from `TF_VAR_*` and `ARM_SUBSCRIPTION_ID`. Locally they are read from a git-ignored `infra/envs/<env>.secrets.env`.

The subscription `Monbo-DEV` constrains who can assign roles. Operators are Owners through the `Devs-Contributors` group, with an ABAC condition that lets them assign only:

- Reader;
- Storage Blob Data Contributor, Owner and Reader;
- AcrPull, AcrPush and AcrDelete.

Kevin is the only unconditional Owner. The repository is public, its default branch is `dev`, it has no GitHub Environments yet, and the operator is a repository admin.

This is change 5 of 5 in the infra roadmap.

## Goals / Non-Goals

**Goals:**

- A merge into `dev` that changes the deployed apps updates `dev` without anyone running anything.
- No long-lived credentials anywhere: no client secret, no registry password, no storage key stored in GitHub.
- The same `deploy.sh`, with the same verification and rollback, locally and in CI.
- Least privilege for the deploy identity, within what the ABAC condition and one manual step allow.

**Non-Goals:**

- Terraform plans on pull requests, and drift detection on a schedule.
- Production and `main`.
- Applying `platform`, seeding, managing countries.
- Notifications beyond the run summary.

## Decisions

### D1. A user-assigned managed identity with a federated credential, in `platform`

`azurerm_user_assigned_identity` `monbo-<env>-deploy` in `monbo-<env>-platform`, plus `azurerm_federated_identity_credential` with:

- issuer `https://token.actions.githubusercontent.com`;
- audience `api://AzureADTokenExchange`;
- subject `repo:undp/monbo:environment:<env>`.

Only jobs that declare `environment: dev` get a token Azure accepts, and the environment itself is restricted to the `dev` branch (D4). So a pull request, including one from a fork, can never obtain it.

- **Alternative: an Entra app registration with a federated credential.** It needs Entra ID permissions (Application Administrator or similar) that the team may not have, and lives outside the subscription. A managed identity is an Azure resource the operators can already create.
- **Alternative: a client secret in GitHub.** Rejected: it is a long-lived credential that needs rotating.

It lives in `platform` because it outlives app deploys and must exist before the first CI run. The `apps` stack can't hold it, since `apps` is what the identity applies.

### D2. Roles: Terraform assigns what it can; two are assigned by hand

| Role | Scope | Why | Assigned by |
|---|---|---|---|
| Reader | subscription | The azurerm provider lists the subscription's resource providers (`resource_providers_to_register`). Reading `platform`'s resources, the data resource group and `az containerapp show` | Terraform (`platform`) |
| AcrPush | registry | `docker push`, and `az acr repository show` for `--skip-build` | Terraform |
| Storage Blob Data Contributor | state account `monbotfstate` | Read `platform`'s state, read and write `apps`'s state | Terraform. The account isn't managed by Terraform; it is referenced with a data source |
| **Contributor** | **resource group `monbo-<env>-apps`** | Create and update the environment, the pull identity and the apps | **By hand, by an unconditional Owner** |
| **Storage Account Key Operator Service Role** | **storage account `monbo<env>data`** | `listKeys`: `deploy.sh`'s check of the share, and the `apps` data source that registers the share on the environment | **By hand, by an unconditional Owner** |

The ABAC condition doesn't allow operators to grant the last two, and widening it to Contributor would let any operator grant Contributor anywhere in the subscription. A one-time manual grant keeps the condition intact. `docs/suggested_deployment.md` records exactly what was granted and how to check it. Terraform doesn't track those two assignments, which is the trade-off.

The deploy identity never needs to assign roles. The `apps` stack's `AcrPull` assignment already exists, and only a rebuilt `apps` stack would recreate it; that is an operator's job.

### D3. The workflow

```yaml
on:
  push:
    branches: [dev]
    paths: [apps/**, infra/deploy.sh, infra/lib.sh, infra/terraform/apps/**, .github/workflows/deploy.yml]
  workflow_dispatch:
    inputs:
      tag: { description: "Redeploy an existing image tag (empty: build this commit)", required: false }
permissions: {}
concurrency: { group: deploy-dev, cancel-in-progress: false }
jobs:
  deploy:
    environment: dev
    permissions: { id-token: write, contents: read }
```

The steps:

1. **Checkout**, without LFS: the images don't contain the layers.
2. **`azure/login`** with OIDC, SHA-pinned, for the az CLI and `az acr login`.
3. **`setup-terraform`** 1.16.5, without the wrapper.
4. **`infra/deploy.sh dev --yes`**, with `TAG` set to the short SHA, or the input tag plus `--skip-build`.
5. **A summary step that always runs:** environment, tag, URLs and outcome.

Terraform authenticates through `ARM_USE_OIDC=true`, `ARM_CLIENT_ID`, `ARM_TENANT_ID` and `ARM_SUBSCRIPTION_ID`. Both the provider and the azurerm backend (`use_azuread_auth`) pick them up and request GitHub's OIDC token themselves.

- **Path filter on the trigger.** It is fine here because deploys aren't required checks, so nothing waits on a skipped run. `platform` is excluded on purpose: it is applied by hand after reading its plan.
- **`cancel-in-progress: false`.** Cancelling a deploy mid-apply is exactly the half-done state D12 of terraform-infrastructure removes. A newer merge waits and deploys after the one in progress.
- **Parametrized by environment.** The environment name appears once (`env: dev`, `environment: dev`). Adding `prod` later means a second trigger or a matrix keyed on the branch.

### D4. GitHub Environment `dev`

The environment is created with a deployment branch policy of custom branches, `dev` only. Its secrets:

- `AZURE_CLIENT_ID` (the deploy identity), `AZURE_TENANT_ID`, `ARM_SUBSCRIPTION_ID`;
- `TF_VAR_gcp_maps_platform_api_key` and `TF_VAR_gcp_maps_platform_signature_secret`;
- `TF_VAR_admin_session_secret`;
- optionally `TF_VAR_front_gcp_maps_platform_api_key`.

The ids aren't secret strictly speaking, but the subscription was kept out of the repository on purpose, so they are stored as secrets too, and GitHub masks them in logs. Required reviewers are not set for `dev`. They would defeat "merge deploys"; `prod` will want them.

### D5. `lib.sh` and `deploy.sh` under CI

- **`load_env_secrets`** already treats the secrets file as optional and only requires `ARM_SUBSCRIPTION_ID`, which the job sets.
- **`select_subscription`** works for a managed identity login. `az account show` returns the identity.
- **`az acr login`** works with the OIDC-logged-in identity (AcrPush).
- **The rollback's auto-approve path** is already used with `--yes`.
- **Expected changes:** only cosmetic, such as no ANSI colours when `CI` is set, if the log is unreadable, plus a machine-readable outcome for the summary (e.g. `deploy.sh` writes to `$GITHUB_STEP_SUMMARY` when set).

## Risks / Trade-offs

- **[Risk] The two hand-assigned roles drift from the documentation**, or are forgotten in a new environment. → Mitigation: `suggested_deployment.md` lists them with the exact `az role assignment create` commands and a check command. The first CI deploy of an environment fails clearly without them (authorization errors on `listKeys` or the apps resource group).
- **[Risk] A merged change breaks `dev`.** → Mitigation: `deploy.sh` verifies and rolls back. The run fails and shows the failed revision's log command; users keep the previous revision.
- **[Risk] Deploys interrupt a raster ingestion in progress**, now more often. → Mitigation: documented, as for manual deploys. The admin sees the upload as interrupted and retries. It is acceptable in `dev`.
- **[Risk] The workflow file itself is a privileged surface.** → Mitigation:
  - `pull_request` workflows never run it, and the federated subject requires `environment:dev`, which is limited to the `dev` branch;
  - changes to `deploy.yml` arrive through reviewed pull requests, required by the ruleset;
  - actions are SHA-pinned and kept current by Dependabot.
- **[Trade-off] `platform` changes need a manual apply** before or after their merge. That is intended: they hold the layers.
- **[Trade-off] Reader at subscription scope** is wider than strictly needed, but it is read-only. Narrowing it would mean dropping provider registration from the azurerm configuration.

## Migration Plan

The order matters, because the merge that brings `deploy.yml` triggers the first deploy:

1. Implement; apply `platform` by hand. This creates the identity, its federated credential and the three roles.
2. Kevin assigns Contributor on `monbo-dev-apps` and Storage Account Key Operator on `monbodevdata`, using the documented commands.
3. Create the GitHub Environment `dev` (branch policy `dev`) and its secrets. Check them with a `workflow_dispatch` run from `dev` once `deploy.yml` is there, or let the merge do it.
4. Merge. The merge itself deploys `dev` (`deploy.yml` changed).
5. Verify:
   - a docs-only merge doesn't deploy;
   - a redeploy through `workflow_dispatch` with the current tag works;
   - a broken deploy rolls back and fails the run (optional; this was proven locally in terraform-infrastructure 10.3).

**Rollback:** delete or disable `deploy.yml`, and operators keep deploying with `infra/deploy.sh` as before. Remove the identity with a `platform` apply that drops it.

## Open Questions

None.
