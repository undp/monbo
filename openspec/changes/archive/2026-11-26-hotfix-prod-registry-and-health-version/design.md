## Context

- `prod` runs in UNDP's resource group and, since 2026-11-26, deploys from `main` through CI (`DEPLOY_PROD=true`). Its apps still pull with the registry's admin user because `infra/terraform/platform/envs/prod.tfvars:10` sets `registry_admin_enabled = true`, whose comment (line 9) says to set it to false once `monbo-prod-pull` holds AcrPull. That grant exists (role assignment created 2026-11-25 14:34 UTC, checked with `az role assignment list`).
- `registry_admin_enabled` is a `platform` variable (`infra/terraform/platform/variables.tf:58-62`, default `false`). The `apps` stack reads it from the platform state and, when it is false, uses the pull identity instead of the admin credentials (`infra/terraform/apps/api.tf:16-35`). CI applies only `apps` (`.github/workflows/deploy.yml`, header comment); `platform` is applied by hand.
- `GET /health` returns a literal `"version": "0.1.0"` (`apps/api/app/main.py:70`); the app is created with `FastAPI(title="Monbo API", version="2.0.0", ...)` (`apps/api/app/main.py:179`). The API is not an installed package, so `importlib.metadata` can't read the version in production (comment at `apps/api/app/main.py:177-178`). `tests/test_app.py:26` pins the wrong value.
- `dev` has unreleased changes, so this goes out as a hotfix from `main` (`docs/branch_protection.md:197-200`).

## Goals / Non-Goals

**Goals:**
- Turn the `prod` registry's admin user off and pull by managed identity.
- Make `/health` report the released version, from a single source, and ship it as 2.0.1.

**Non-Goals:**
- `dev`'s tfvars (already `false`, `infra/terraform/platform/envs/dev.tfvars:12`).
- The two open OpenSpec changes still present on `main` (`single-resource-group`, `production-environment`): `dev` already archived them, so touching them here would only conflict in the back-merge.
- Docs: `docs/architecture.md:86` and `docs/suggested_deployment.md:183` already describe the admin user as temporary.
- A `response_model` for `/health`: it is outside the OpenAPI contract today and stays so.

## Decisions

- **`/health` reads `request.app.version`.** The FastAPI app's version is already bumped by every release (Release 2.0.0, commit 322d266, touched `main.py`), so `/health` follows it with no new place to edit. Rejected: reading `pyproject.toml` at runtime (it is not copied into the runtime image: `apps/api/Dockerfile.prod:47` copies only `app/`); a new constant (a sixth place for the version).
- **The test compares against `pyproject.toml`.** `tests/test_app.py` reads `version` from `apps/api/pyproject.toml` with `tomllib` and asserts `/health` returns it. That pins both the bug and any future drift between the FastAPI version and the version files.
- **Apply `platform` right before the merge** (user's choice). The merge's CI deploy then applies `apps` with `registry_admin_enabled = false` and switches both apps to the identity in one deploy. Rejected: merge first and redeploy by hand (two deploys, same window).

## API contract

`GET /health` keeps its shape (`version`, `status`, `mapsRoot`, `mapsRootWritable`); only `version`'s value changes. `apps/api/openapi.json` changes only in `info.version`. `schema.d.ts` doesn't carry `info.version`, so it doesn't change. Data shape and cross-stack wiring: N/A, nothing else crosses the boundary.

## Hazards (Step 2b)

| File | Failure mode | Evidence |
|---|---|---|
| `infra/terraform/platform/envs/prod.tfvars` | Admin user off before the apps switch to the identity: a new replica or revision can't pull until `apps` is applied. | `infra/terraform/apps/api.tf:16-35`; mitigated by applying `platform` right before the merge. |
| `apps/api/app/main.py` | Making `/health` async or slower: it runs sync on purpose because `is_writable()` may touch the share. | Comment at `apps/api/app/main.py:66-67`. |
| `apps/api/tests/test_app.py` | None known. | — |
| `apps/api/openapi.json` | Stale contract fails both CI jobs. | `CLAUDE.md`, "Changing a contract". |
| `apps/api/uv.lock` | Edited by hand inconsistently with `pyproject.toml`, `uv sync --frozen` fails. | `apps/api/Dockerfile.prod:21`. |
| Version files, `CHANGELOG.md` | One of the four left behind. | `CLAUDE.md`, Repo-wide; release commit 322d266 touched all eight. |

## Risks / Trade-offs

- [Pull window between the `platform` apply and the CI deploy] → apply right before merging, and watch the deploy; if `apps` fails, set `registry_admin_enabled = true` again and apply `platform`.
- [Back-merge conflicts in `main.py`] → `dev` changed only the imports and router lines of `main.py`, not `/health`; the back-merge PR resolves anything else.

## Migration Plan

1. PR approved and green. 2. `terraform plan` then apply `platform` for `prod` from this branch (only the registry's `admin_enabled` should change). 3. Merge into `main` at once; CI deploys `apps` and pulls by identity. 4. Check `/health` reports `2.0.1` and `az acr show` reports `adminUserEnabled: false`. 5. Back-merge PR `main` → `dev`. Rollback: `registry_admin_enabled = true`, apply `platform`, redeploy.

## Signal tracing

N/A: the change introduces no signal; `/health`'s `version` is an existing field whose value is corrected.
