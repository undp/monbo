## 1. PR 1 — Hygiene + uv + orchestration + CI (prerequisite for all)

**Branch:** `chore/dependency-toolchain-upgrade` — **Title:** `chore: migrate Python to uv, add root orchestrator, CI`

- [x] 1.1 Create `monbo-api/pyproject.toml` with production deps + a `dev` dependency-group (pytest, pytest-cov, ruff, black, mypy); generate committed `uv.lock`; add `.python-version=3.11`
- [x] 1.2 Remove `monbo-api/requirements.txt` and collapse the duplicated `fastapi` + `fastapi[standard]` into a single `fastapi[standard]` entry
- [x] 1.3 Add pytest config (`testpaths`) to `monbo-api/pyproject.toml`
- [x] 1.4 Update `monbo-api/Dockerfile.dev` and `Dockerfile.prod` to install via `uv sync --frozen` (prod adds `--no-dev`)
- [x] 1.5 Rewrite `monbo-api/package.json` wrapper scripts to delegate to uv
- [x] 1.6 Migrate `scripts/update-gfw-tmf` to uv (`pyproject.toml` + `uv.lock`), preserving current pins including `tenacity<9` for now
- [x] 1.7 Complete the root orchestrator: declare an exact `concurrently` version as a root devDependency, invoke it via `pnpm exec concurrently` (not mutable `pnpm dlx`), and commit the resulting root `pnpm-lock.yaml`; keep `monbo-front/pnpm-lock.yaml` and both `uv.lock` files in their package directories and do not add `pnpm-workspace.yaml`
- [x] 1.8 Add `packageManager` (pnpm) to `monbo-front/package.json` (the `engines` field is deferred to PR 8, alongside the `node:22-alpine` Docker bump, so local dev on Node 20 isn't broken in the meantime)
- [x] 1.9 Add GitHub Actions frontend workflow: `actions/setup-node` pinned to Node 22 + `pnpm install --frozen-lockfile` + `tsc --noEmit` + lint + build, caching pnpm store and `.next/cache` (Node 22 needed because eslint 10 in PR 7 requires Node >= 22.13; the Docker bump doesn't land until PR 8, but Node 22 runs the current Next 15.3 without issue)
- [x] 1.10 Add the GitHub Actions API workflow infrastructure (`uv sync --frozen` + pytest + ruff/black/mypy) in explicitly temporary report-only mode, documenting that inherited failures are why `continue-on-error` is present
- [x] 1.11 Before PR 1 acceptance, repair the inherited pytest collection/execution failures and make the full suite pass deterministically; do not treat the existing TODO or report-only result as an accepted baseline
- [x] 1.12 Before PR 1 acceptance, create a deterministic, version-controlled deforestation fixture with no network/current-data dependency; capture expected ratios and decoded imagery from the approved pre-upgrade Python 3.11/rasterio 1.4/numpy 1 environment; record tool versions and Linux x86_64 as the blocking platform; automate the tolerance checks defined by `python-dependency-toolchain` — fixture + capture script + baseline committed under `monbo-api/tests/numeric_baseline/`, gate at `monbo-api/tests/test_numeric_baseline.py`
- [x] 1.13 Run the repaired suite and numeric fixture under PR 1's committed `uv.lock` (which already resolves numpy 2.4.6); block PR 1 unless scalar ratios, raster metadata/masks/pixels, and decoded rendered imagery satisfy the specified tolerances — passes on Linux x86_64 under numpy 2.4.6
- [x] 1.14 Repair the inherited ruff, black, and mypy failures, then remove `continue-on-error` from pytest, ruff, black, and mypy so every API step is blocking
- [ ] 1.15 Verify repository branch protection/rulesets require the successful frontend and API workflow checks before merge; record the required check names and confirm a failing check prevents merging — MANUAL GitHub step (repository Settings → Branches / Rulesets); the workflows are ready but branch protection cannot be configured from the codebase. Required check names to add: API CI job `Test and static checks` and the frontend workflow job.
- [x] 1.16 Configure workflow triggers: `types: [opened, synchronize, ready_for_review]` + `if: github.event.pull_request.draft == false`
- [x] 1.17 Update root, `monbo-api`, `monbo-front`, and `scripts` READMEs for uv + orchestrator + workflow

## 2. PR 2 — API minors (Python track)

**Branch:** `chore/api-deps-minors` — **Title:** `chore(deps): bump API minors (shapely, geopandas, pyproj, uvicorn…)`

- [ ] 2.1 Bump shapely 2.1.2, geopandas 1.1.4, pyproj 3.7.2, uvicorn 0.51, colorlog 6.10, python-dotenv 1.2 (keep rasterio 1.4.3 until PR 4); refresh `uv.lock`
- [ ] 2.2 Run `uv run pytest` and smoke `/health` + a deforestation analysis

## 3. PR 3 — API nominal majors (Python track)

**Branch:** `chore/api-deps-majors` — **Title:** `chore(deps): bump API majors (pillow 12, pytest 9, pycountry 26, fastapi 0.139)`

- [ ] 3.1 Bump pillow 12, pytest 9 + pytest-cov 7, pycountry 26, fastapi 0.139; refresh `uv.lock`
- [ ] 3.2 Confirm no removed pillow APIs are used and there is no `on_event` usage (Pydantic already v2); run pytest

## 4. PR 4 — Python 3.12 + rasterio 1.5 (Python track, runtime gate)

**Branch:** `chore/api-python-3.12` — **Title:** `build: raise API runtime to Python 3.12 + rasterio 1.5 (numpy 2)`

- [ ] 4.1 Raise `.python-version` and `requires-python` to 3.12; set `python:3.12-slim` in both API Dockerfiles
- [ ] 4.2 Verify and update any hardcoded versioned paths (e.g. `/usr/local/lib/python3.11/site-packages`) in `monbo-api/Dockerfile.prod`'s multi-stage `COPY --from=api-builder` step; this path may already be gone after the uv rewrite in PR 1 — confirm and update to `python3.12` if it is still present
- [ ] 4.3 Bump rasterio to 1.5 and refresh `uv.lock`; explicitly verify the selected numpy version (numpy 2 was already present in the PR 1 lock, so this is not its first introduction)
- [ ] 4.4 Raise mypy `python_version` 3.10 → 3.12 in the authoritative `monbo-api/pyproject.toml`; remove the duplicate root `[tool.mypy]` block if it is orphaned, or consolidate to one shared authoritative configuration if a root invocation is retained; update README
- [ ] 4.5 Hard gate: on Linux x86_64, run the repaired full pytest suite and the automated PR 1 numeric fixture against the Python 3.12/rasterio 1.5 lock; block unless ratios, raster metadata/masks/pixels, and decoded rendered imagery satisfy the exact tolerances in `python-dependency-toolchain`

## 5. PR 5 — Script GFW/TMF (Python track)

**Branch:** `chore/gfw-tmf-deps` — **Title:** `chore(deps): update GFW/TMF script (uncap tenacity, bump earthengine/geemap)`

- [ ] 5.1 Remove the `tenacity<9` cap and bump earthengine-api / geemap; refresh `uv.lock`
- [ ] 5.2 Validate with a bounded run + `gdalinfo` on the output

## 6. PR 6 — Front minors (Front track)

**Branch:** `chore/front-deps-minors` — **Title:** `chore(deps): bump frontend minors (react 19.2, date-fns, lodash…)`

- [ ] 6.1 Bump react/react-dom 19.2 together with `@types/react` and `@types/react-dom` in the same commit
- [ ] 6.2 Bump @react-pdf/renderer 4.5, @vis.gl/react-google-maps 1.9, date-fns 4.4, fuse.js 7.4, lodash 4.18 (+ `@types/lodash`), @googlemaps/markerclusterer 2.6, @fontsource/roboto, @emotion/styled, next-i18n-router 5.5.8, @eslint/eslintrc; refresh `pnpm-lock.yaml`
- [ ] 6.3 Run `tsc --noEmit` + lint + build

## 7. PR 7 — Front toolchain (Front track; lands after PR 8 and precedes PR 9)

**Branch:** `chore/front-toolchain-ts6-eslint10` — **Title:** `chore(deps): upgrade frontend toolchain (TypeScript 6 + eslint 10)`

- [ ] 7.1 Bump TypeScript to 6.0
- [ ] 7.2 After PR 8 has landed and established Node 22 in local/Docker/CI metadata, bump eslint to 10 (requires Node 20.19 / 22.13 / 24+); do not merge this PR onto the prior Node 20 baseline
- [ ] 7.3 Align `@types/node` to 22.x matching the real runtime (NOT 26); refresh `pnpm-lock.yaml`
- [ ] 7.4 Run `tsc --noEmit` + lint + build

## 8. PR 8 — Next 16 + Node 22 (Front track; lands before PR 7)

**Branch:** `chore/front-next16-node22` — **Title:** `build: upgrade frontend to Next 16 + Node 22`

- [ ] 8.1 Bump next 16.2.10 + eslint-config-next 16
- [ ] 8.2 Set `node:22-alpine` in both frontend Dockerfiles; add `engines` (Node >=22) to `monbo-front/package.json`
- [ ] 8.3 In `monbo-front/Dockerfile.dev` and `monbo-front/Dockerfile.prod`, stop installing a mutable global pnpm; enable Corepack, use the exact pnpm version from `packageManager`, and install dependencies with `pnpm install --frozen-lockfile`
- [ ] 8.4 Change lint script `next lint` → `eslint .` (next lint removed in 16)
- [ ] 8.5 Remove `--turbo` from the dev script (Turbopack is default); confirm `next build --webpack` fallback works
- [ ] 8.6 Evaluate/apply the middleware→proxy codemod for `src/middleware.tsx`
- [ ] 8.7 Manually verify `output: "standalone"` by running `postbuild` + `start:standalone`, exercising a rendered page, and confirming MUI SSR styling; record the result in PR 8 (this is an acceptance check, not a frontend CI workflow step)
- [ ] 8.8 Confirm pages still use `await params/searchParams` (already verified); run the CI-equivalent `pnpm install --frozen-lockfile` + `tsc --noEmit` + lint + build

## 9. PR 9 — i18n majors (Front track; after PR 7)

**Branch:** `chore/front-i18next-26` — **Title:** `chore(deps): upgrade i18next 26 + react-i18next 17`

- [ ] 9.1 Bump i18next 26.3 + react-i18next 17 together (peer `i18next >= 26.2`); refresh `pnpm-lock.yaml`
- [ ] 9.2 Fix the usages of `TFunction` (8 files, verify with grep at implementation time): `src/components/page/deforestationAnalysis/DeforestationResultsTable.tsx`, `src/components/page/polygonsValidation/InconsistentFarmsTable.tsx`, `src/components/page/polygonsValidation/DownloadPageData.tsx`, `src/components/page/polygonsValidation/GeometryInconsistencyModal.tsx`, `src/components/page/polygonsValidation/OverlapInconsistencyModal.tsx`, `src/utils/deforestationReport.tsx`, `src/utils/deforestationReport/sections.tsx`, `src/utils/excel.ts`
- [ ] 9.3 Run `tsc --noEmit`; exhaustive es↔en smoke of all flows

## 10. PR 10 — Front small majors + MUI 7 (Front track)

**Branch:** `chore/front-mui7` — **Title:** `chore(deps): upgrade MUI 7 + small majors (react-dropzone 15, p-limit 7)`

- [ ] 10.1 Bump react-dropzone 15 (no `isDragReject` usage) and p-limit 7 (only `pLimit(20)` used)
- [ ] 10.2 Run the official MUI 6 → 7 codemod
- [ ] 10.3 Migrate `Grid2` → `Grid` in `src/app/[locale]/page.tsx` and `src/components/page/deforestationAnalysis/MapsDetailsModal.tsx`
- [ ] 10.4 Update `@mui/material-nextjs/v15-appRouter` → `v16` import in `src/app/layout.tsx`; refresh `pnpm-lock.yaml`
- [ ] 10.5 Complete the visual review checklist against affected screens

## 11. PR 11 — Dependabot (dependency bot; final, standalone)

**Branch:** `chore/dependabot` — **Title:** `chore: add Dependabot for automated dependency updates`

- [ ] 11.1 Add `.github/dependabot.yml` (`version: 2`) with a weekly `schedule.interval` for every ecosystem/directory: `npm` (`/` for the root orchestrator and `/monbo-front`), `uv` (`/monbo-api` and `/scripts/update-gfw-tmf`), `docker` (each Dockerfile directory), and `github-actions` (`/`)
- [ ] 11.2 Group minor/patch updates per ecosystem (`groups`) and keep majors separate; set `open-pull-requests-limit` to bound the queue; do not enable automerge
- [ ] 11.3 Verify the `uv` ecosystem updates `pyproject.toml` and `uv.lock` in sync (watch dependabot-core #12788 / #13426, especially given the `==` pins in `monbo-api`); confirm generated PRs pass CI before merging
- [ ] 11.4 Confirm with an actual Dependabot scan/test PR that the Docker entries detect both non-standard filenames, `Dockerfile.dev` and `Dockerfile.prod`, in `monbo-api` and `monbo-front`; if Dependabot cannot discover them by directory, document and implement an explicit supported coverage strategy before declaring Docker coverage complete
- [ ] 11.5 Decide and document whether the `ghcr.io/astral-sh/uv` image used by `COPY --from` is in Docker-update scope; if it is, verify Dependabot updates it, and if it is not, record the owner/manual update policy
- [ ] 11.6 Evaluate pinning every third-party GitHub Action to a full commit SHA (with a version comment) instead of mutable `@vN` tags; adopt it or record the risk-based decision, and verify Dependabot can continue updating the chosen form
- [ ] 11.7 Update READMEs to document the Dependabot policy

## 12. Cross-cutting validation and close-out

- [ ] 12.1 Confirm blocking CI green with no `continue-on-error` (frontend: install --frozen-lockfile + tsc --noEmit + lint + build; API: uv sync --frozen + uv run pytest, including the numeric fixture, + ruff/black/mypy) and re-confirm branch protection requires both jobs
- [ ] 12.2 API smoke: `/health` + deforestation analysis numbers/imagery vs the version-controlled reference case (re-confirm after PR 4)
- [ ] 12.3 Re-confirm the separate PR 8 manual `postbuild` + `start:standalone` verification and MUI SSR result; do not report it as a CI step
- [ ] 12.4 Front manual smoke of 4 flows in es and en: home/country selection; polygon validation with upload + Excel/GeoJSON downloads; deforestation analysis with map/clusters/modals; PDF report
- [ ] 12.5 Verify deferred items (MUI 9, Turborepo, Python 3.13 / Node 24, xlsx 0.18.5) remain untouched and documented as out-of-scope
