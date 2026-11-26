## Why

Production now deploys from `main` through CI, and UNDP's administrator granted AcrPull on `monboprodacr` to `monbo-prod-pull` on 2026-11-25. The registry's admin user, which `prod` kept on only until that grant (`infra/terraform/platform/envs/prod.tfvars:9-10`), is now an unneeded credential and should be turned off. Separately, `GET /health` reports `"version": "0.1.0"` (`apps/api/app/main.py:70`) while the API is 2.0.0, so the one endpoint operators check after a deploy reports the wrong version. Both ship as a hotfix from `main`, because `dev` holds changes that must not reach production yet.

## What Changes

- `prod` pulls its images with the managed identity `monbo-prod-pull`: `registry_admin_enabled = false` in `infra/terraform/platform/envs/prod.tfvars`, which turns the registry's admin user off once `platform` is applied.
- `GET /health` reports the API's own version (the FastAPI app's `version`) instead of a hard-coded `0.1.0`.
- Release 2.0.1: the four version files, the FastAPI app's version, the generated `openapi.json` and `uv.lock` move to 2.0.1, with a `[2.0.1]` entry in `CHANGELOG.md`.

## Capabilities

### New Capabilities

- `api-health`: what `GET /health` reports about the running API, starting with its version.

### Modified Capabilities

(none)

## Impact

- API: `apps/api/app/main.py` (`/health`), `apps/api/tests/test_app.py`.
- Infra: `infra/terraform/platform/envs/prod.tfvars`; `platform` is applied by hand for `prod` right before the merge, and the merge's CI deploy applies `apps`, which then pulls by identity.
- Release files: `package.json`, `apps/api/package.json`, `apps/web/package.json`, `apps/api/pyproject.toml`, `apps/api/uv.lock`, `apps/api/openapi.json`, `CHANGELOG.md`.
- Branch flow: PR into `main` (hotfix), then a `main` → `dev` back-merge PR (`docs/branch_protection.md`, "Release and hotfix flow").
