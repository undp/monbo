## 1. Health reports the API version

Files: apps/api/app/main.py, apps/api/tests/test_app.py

- [x] 1.1 Fix tripwire (red before the fix): in `apps/api/tests/test_app.py`, `test_health_check` reads `version` from `apps/api/pyproject.toml` (`tomllib`, path relative to the test file) and asserts `body["version"]` equals it, replacing the literal `"0.1.0"`. Observe it red against the current `main.py`. Minimal mutant after the fix: `--find 'request.app.version' --replace '"0.1.0"'` on `apps/api/app/main.py`.
- [x] 1.2 Add a regression guard: `create_app()`'s FastAPI `version` equals `pyproject.toml`'s `version` (so a release that misses `main.py` fails). Minimal mutant: `--find 'version="2.0.1"' --replace 'version="2.0.0"'` on `apps/api/app/main.py`.
- [x] 1.3 `health_check` takes `request: Request` and returns `request.app.version`; it stays a sync `def` (comment at `main.py:66-67`).

## 2. Release 2.0.1

Files: package.json, apps/api/package.json, apps/web/package.json, apps/api/pyproject.toml, apps/api/uv.lock, apps/api/app/main.py, apps/api/openapi.json, CHANGELOG.md

- [x] 2.1 Bump 2.0.0 → 2.0.1 in the four version files and in `FastAPI(..., version=...)`; refresh `uv.lock` with `uv lock` (only the `monbo-api` version line changes) and regenerate the contract with `pnpm contracts` (only `info.version` in `openapi.json` changes; `schema.d.ts` unchanged).
- [x] 2.2 `CHANGELOG.md`: a `## [2.0.1] - <date>` section under `[Unreleased]` with a `### Fixed` entry (`/health` reports the API version) and a `### Changed` entry (production pulls its images with its managed identity; the registry's admin user is off).

## 3. Production pulls by managed identity

Files: infra/terraform/platform/envs/prod.tfvars

- [x] 3.1 `registry_admin_enabled = false` in `infra/terraform/platform/envs/prod.tfvars`, and update its comment to say AcrPull was granted. Done when `terraform fmt -check` passes and `terraform -chdir=infra/terraform/platform test` stays green. No new automated test: `platform.tftest.hcl:160-165` already covers `registry_admin_enabled = false`; the manual check is the `prod` plan showing only the registry's `admin_enabled` changing.

Groups 1 and 3 are disjoint; group 2 shares `apps/api/app/main.py` with group 1 (the version literal only).
