## Context

`dev` is the only environment. It runs in a test subscription and is deployed by `.github/workflows/deploy.yml` on every merge into `dev` that changes the apps. The pieces involved:

- **Terraform:** two stacks per environment, `platform` (the layers, registry and logs, applied by hand) and `apps` (the Container Apps, applied by `infra/deploy.sh` on every deploy). Each environment is a pair of files per stack: `envs/<env>.tfvars` and `envs/<env>.backend.hcl`.
- **Scripts:** `deploy.sh`, `lib.sh` and `tools/layers-ops/layers-ops.sh` take the environment as an argument and read nothing `dev`-specific.
- **State:** it lives in `monbotfstate` (resource group `monbo-tfstate`), created by `infra/bootstrap.sh`. Both the backend files and the deploy identity's role assignment name that account; in `platform`, through a variable whose default is `monbotfstate`.
- **CI identity:** the deploy identity `monbo-<env>-deploy` trusts only GitHub jobs in the GitHub Environment `<env>`. It holds three roles granted by Terraform and two granted by an unconditional Owner.

Production will live in a subscription of UNDP's Azure, possibly in another Entra tenant. Access is being requested, and its exact shape (subscription-wide or per resource group, which Azure Policies apply, who can grant roles) is not known yet. `main` receives releases (dev → main merge commits) and hotfixes. Its ruleset still requires the old web check name, to be switched at the next release.

## Goals / Non-Goals

**Goals:**

- Once UNDP grants access, standing up production is a documented procedure with no code changes.
- A merge into `main` deploys `prod` with the same script, verification and rollback as `dev`.
- Releases can keep going to `main` before production exists, without failed runs.
- `prod`'s credentials and state are isolated from `dev`'s: separate identity, GitHub Environment, state account and secrets.

**Non-Goals:**

- A custom domain (`*.undp.org`) for production.
- Promoting `dev`'s images to `prod` instead of building them.
- Required reviewers or wait timers on the `prod` environment. They are a repository setting, documented as an option.
- Adapting the stacks to access restricted to pre-created resource groups (see Open Questions).
- Requesting the access itself.

## Decisions

### D1. One workflow; the branch selects the environment

`deploy.yml` triggers on pushes to `[dev, main]`, with the same path filter, and on `workflow_dispatch`. The job computes the environment from the branch:

```yaml
environment:
  name: ${{ github.ref_name == 'main' && 'prod' || 'dev' }}
```

The same expression sets `ENV_NAME` and the concurrency group (`deploy-dev` or `deploy-prod`). `environment` and `concurrency` can't read the `env` context, so the expression is repeated there, not computed once.

A manual run on any other branch maps to `dev`, and the `dev` environment's branch policy refuses it, as today.

- **Alternative: a separate `deploy-prod.yml`.** Rejected: it would duplicate every step, and the two copies would drift.
- **Alternative: a matrix over environments.** Rejected: one push only ever deploys one environment.

### D2. `DEPLOY_PROD` switches production deploys on

The job has:

```yaml
if: github.ref_name != 'main' || vars.DEPLOY_PROD == 'true'
```

`DEPLOY_PROD` is a repository variable, not an environment variable, because environment variables aren't available to a job's `if`. Until it is set, pushes and manual runs on `main` skip the job, which shows as skipped, not failed.

- **Why a switch at all:**
  - This change reaches `main` with the next release, whatever that release contains. Production may not exist by then.
  - Without the switch, every push to `main` would fail at the Azure login.
  - Referencing a missing environment makes GitHub create `prod` on the fly, with no branch policy.
- **Alternative: keep this change out of `main` until production exists.** Rejected: releases merge all of `dev`, so it can't be held back.

### D3. One state account per environment

`prod`'s state lives in `monboprodtfstate`, in resource group `monbo-tfstate` of prod's subscription, created by `bootstrap.sh monboprodtfstate`. `dev` keeps `monbotfstate`.

The account name stops having a default in `platform` (as in `apps` already). Every environment sets `state_storage_account_name` in both stacks' tfvars, so a new environment can't silently point at `dev`'s state. For `dev` this is a no-op plan.

- **Why:**
  - Storage account names are global, so `monbotfstate` can't be created again in the second subscription.
  - The deploy identity's federated trust and roles live in prod's subscription and possibly in another tenant.
  - Granting it access to an account in `dev`'s subscription would tie production to the test subscription, and may be impossible across tenants.
  - Separate accounts also mean `dev`'s operators and identity can't touch prod's state, which contains prod's secrets.
- **Alternative: one shared state account with per-environment keys.** Rejected for the reasons above.

`bootstrap.sh` already takes the account name. Its wording changes from "once per subscription" to "once per state account".

### D4. Production builds its own images from `main`

`deploy.sh prod` builds both images from the pushed commit and pushes them to `monboprodacr`, tagged with that commit, as in `dev`.

A release's merge commit has the same tree as the `dev` commit it releases. The build reproduces it with the same pinned lockfiles and base images, as of the build date.

- **Alternative: import `dev`'s tested images into `monboprodacr`.** Rejected for now:
  - it needs cross-subscription, possibly cross-tenant, registry access;
  - it needs a way to map the `main` merge commit back to the `dev` tag;
  - it would split the deploy into two scripts.

  Reconsider if base-image drift between the `dev` and `prod` builds ever causes a difference.

### D5. GitHub Environment `prod`: limited to `main`, created first

`prod` holds the same secret names as `dev`, with prod's values:

- `AZURE_CLIENT_ID` and `AZURE_TENANT_ID`, from prod's `platform` outputs;
- `ARM_SUBSCRIPTION_ID`;
- the Google Maps keys;
- `ADMIN_SESSION_SECRET`.

Its deployment branch policy allows only `main`. It is created before prod's `platform` apply creates the federated credential that trusts `environment:prod`. That way there is never a window where the credential exists and the environment has no branch policy.

No required reviewers by default: merging the release pull request is the approval, as in `dev`. Adding one is documented as an option.

### D6. `prod`'s settings

`apps/envs/prod.tfvars` starts with:

- the same sizes, thresholds and contact URL as `dev`;
- `show_testing_environment_warning = false`.

`platform/envs/prod.tfvars` sets:

- `env = "prod"`;
- the region (`eastus2` until UNDP confirms the allowed regions);
- the state account.

The names come out as `monbo-prod-data`, `monbo-prod-platform`, `monbo-prod-apps`, `monboproddata` and `monboprodacr`. If a global name is taken, `unique_suffix` handles it.

Nothing account-specific is committed: no subscription, tenant, Entra group or person. They come from `ARM_SUBSCRIPTION_ID` and the GitHub Environment.

## Risks / Trade-offs

- **[An Azure Policy in UNDP's subscription forbids shared-key access on storage accounts]** → The Container Apps environment mounts the share with the account key, and `deploy.sh` and `layers-ops.sh` call `listKeys`, so production can't run. Mitigation: ask for the policy list before the first apply. If it applies, an exemption or a separate change (for example NFS over a VNet).
- **[Policies that deny public network access, restrict regions or require tags]** → The `platform` plan fails. Mitigation: same request. Region and tags are tfvars or `local.tags` changes.
- **[Access is granted per resource group, not on the subscription]** → Terraform creates the resource groups, and the deploy identity gets Reader on the subscription. Both need subscription scope. Mitigation: ask for subscription scope. Otherwise a follow-up change reads pre-created groups as data sources.
- **[The operators' Owner role carries an ABAC condition, as in `dev`]** → The two manual roles (Contributor on `monbo-prod-apps`, Key Operator on `monboproddata`) need an unconditional Owner. The first `deploy.sh prod` also creates `AcrPull` for the pull identity. Mitigation: documented. Ask that the condition allow these six roles: Reader, AcrPush, AcrPull, Storage Blob Data Contributor, Contributor and Storage Account Key Operator Service Role.
- **[A release triggers a production deploy carrying many changes at once]** → Mitigations:
  - `deploy.sh` verifies and rolls back;
  - a manual run on `main` with an earlier tag redeploys the previous images;
  - `DEPLOY_PROD=false` stops automatic deploys without touching the workflow.
- **[The first release into `main` is blocked by the ruleset's old check name]** → Mitigation: the procedure includes switching it right before that merge, per `docs/branch_protection.md`.
- **[Hotfixes into `main` deploy `prod` directly]** → Intended: the hotfix pull request into `main` is reviewed and passes CI like any release.

## Migration Plan

1. Merge this change into `dev`. Nothing deploys to `prod`: there is no push to `main` yet, and `DEPLOY_PROD` is unset.
2. Release to `main` whenever needed. The deploy job is skipped on `main`.
3. Once UNDP access is granted, follow the documented procedure, in order:
   1. GitHub Environment `prod`, limited to `main`;
   2. `bootstrap.sh monboprodtfstate`;
   3. `platform` plan and apply;
   4. the two Owner-granted roles;
   5. `layers-ops.sh prod seed`, saving the passkeys;
   6. `infra/deploy.sh prod` by hand;
   7. the environment's secrets;
   8. `DEPLOY_PROD=true`;
   9. a manual run on `main`, or the next release.

**Rollback:**

- Set `DEPLOY_PROD` to anything but `true`, or disable the workflow.
- Redeploy an earlier tag with a manual run on `main`.
- Production's resources are independent of `dev`'s. Destroying `apps` loses no data; `platform` keeps its locks and `prevent_destroy`.

## Open Questions

- What scope will the access have: subscription or resource groups? Is the operators' role conditioned?
- Which Azure Policies apply? Shared-key storage, public network access, regions and tags matter.
- Is prod's subscription in another Entra tenant? The operators then need guest accounts there. The code doesn't care: the tenant id is a per-environment secret.
- A custom domain, and who manages its DNS.
- Production sizes, and the Google Maps keys restricted to prod's domain.
