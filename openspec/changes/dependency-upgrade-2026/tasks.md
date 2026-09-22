> **Resequenced 2026-09-22.** The Python track order is now **PR 1 → PR 4a (Python 3.13) → PR 2 → PR 3 → PR 4b (rasterio 1.5) → PR 5**. The interpreter bump was split out of PR 4 and moved ahead of the dependency PRs because rasterio 1.4.3 publishes cp313 wheels, so Python 3.13 does not require rasterio 1.5 — see design D3 and R10. This unblocks pyproj 3.8.0 in PR 2 and geemap in PR 5, which the old 3.11 floor made impossible.
>
> **Revised 2026-09-22.** Version targets were set on 2026-07-08 and have been re-validated against PyPI, the npm registry, and the Node/Python release calendars. Pinned numbers below are refreshed; three decisions changed (Node 22 → 24, Python 3.12 → 3.13, TypeScript pinned at 6.0.3 with 7 deferred — see design D3, D4, D10) and two silently-absorbed risks were promoted to explicit tasks (dev-tool pins per D9, pandas 3 per R8). Completed PR 1 tasks were not re-opened; where a revised target affects already-shipped work, the follow-up lives in the PR that owns the runtime.

## 1. PR 1 — Hygiene + uv + orchestration + CI (prerequisite for all)

**Branch:** `chore/dependency-toolchain-upgrade` — **Title:** `chore: migrate Python to uv, add root orchestrator, CI`

- [x] 1.1 Create `monbo-api/pyproject.toml` with production deps + a `dev` dependency-group (pytest, pytest-cov, ruff, black, mypy); generate committed `uv.lock`; add `.python-version=3.11`
- [x] 1.2 Remove `monbo-api/requirements.txt` and collapse the duplicated `fastapi` + `fastapi[standard]` into a single `fastapi[standard]` entry
- [x] 1.3 Add pytest config (`testpaths`) to `monbo-api/pyproject.toml`
- [x] 1.4 Update `monbo-api/Dockerfile.dev` and `Dockerfile.prod` to install via `uv sync --frozen` (prod adds `--no-dev`)
- [x] 1.5 Rewrite `monbo-api/package.json` wrapper scripts to delegate to uv
- [x] 1.6 Migrate `scripts/update-gfw-tmf` to uv (`pyproject.toml` + `uv.lock`), preserving current pins including `tenacity<9` for now
- [x] 1.7 Complete the root orchestrator: declare an exact `concurrently` version as a root devDependency, invoke it via `pnpm exec concurrently` (not mutable `pnpm dlx`), and commit the resulting root `pnpm-lock.yaml`; keep `monbo-front/pnpm-lock.yaml` and both `uv.lock` files in their package directories and do not add `pnpm-workspace.yaml`. Note the pinned `concurrently` declares `engines.node >=22`: document in the root README and onboarding that the orchestrator wants Node ≥22 while the individual packages stay on Node 20 until PR 8 (with `engine-strict` off it warns rather than fails on Node 20) — the Node 24 runtime decision itself remains in PR 8 (see design D2/D4, revised 2026-09-22: the runtime target is Node 24, which also satisfies the orchestrator's ≥22 floor)
- [x] 1.8 Add `packageManager` (pnpm) to `monbo-front/package.json` (the `engines` field is deferred to PR 8, alongside the `node:24-alpine` Docker bump, so local dev on Node 20 isn't broken in the meantime)
- [x] 1.9 Add GitHub Actions frontend workflow: `actions/setup-node` pinned to Node 22 + `pnpm install --frozen-lockfile` + `tsc --noEmit` + lint + build, caching pnpm store and `.next/cache` (Node 22 needed because eslint 10 in PR 7 requires Node >= 22.13; the Docker bump doesn't land until PR 8, but Node 22 runs the current Next 15.3 without issue) — revision note 2026-09-22: PR 8 now targets Node 24, so this CI pin is a bootstrap value; raising `setup-node` to 24 is task 8.9 and is not a reason to re-open this completed task
- [x] 1.10 Add the GitHub Actions API workflow infrastructure (`uv sync --frozen` + pytest + ruff/black/mypy) in explicitly temporary report-only mode, documenting that inherited failures are why `continue-on-error` is present
- [x] 1.11 Before PR 1 acceptance, repair the inherited pytest collection/execution failures and make the full suite pass deterministically; do not treat the existing TODO or report-only result as an accepted baseline
- [x] 1.12 Before PR 1 acceptance, create a deterministic, version-controlled deforestation fixture with no network/current-data dependency; capture expected ratios and decoded imagery from the approved pre-upgrade Python 3.11/rasterio 1.4/numpy 1 environment; record tool versions and Linux x86_64 as the blocking platform; automate the tolerance checks defined by `python-dependency-toolchain` — fixture + capture script + baseline committed under `monbo-api/tests/numeric_baseline/`, gate at `monbo-api/tests/test_numeric_baseline.py`
- [x] 1.13 Run the repaired suite and numeric fixture under PR 1's committed `uv.lock` (which already resolves numpy 2.4.6); block PR 1 unless scalar ratios, raster metadata/masks/pixels, and decoded rendered imagery satisfy the specified tolerances — passes on Linux x86_64 under numpy 2.4.6
- [x] 1.14 Repair the inherited ruff, black, and mypy failures, then remove `continue-on-error` from pytest, ruff, black, and mypy so every API step is blocking
- [ ] 1.15 Verify repository branch protection/rulesets require the successful frontend and API workflow checks before merge; record the required check names and confirm a failing check prevents merging — **MANUAL GitHub step, blocked on permissions.** Verified 2026-09-22: `undp/monbo` has no rulesets (`GET /repos/undp/monbo/rulesets` returns `[]`) and no branch protection on `main` (`GET /repos/undp/monbo/branches/main/protection` returns 404), so nothing currently gates merges. The account working this change has `push`/`triage` but not `admin` or `maintain`, so it cannot create the rule; a repository admin must apply it. The two required status check contexts, read from the workflow job `name:` fields and confirmed against the checks reported on PR #14, are exactly:
  - `Test and static checks` (job `api` in `.github/workflows/api.yml`, workflow `API CI`)
  - `Type-check, lint, build` (job `frontend` in `.github/workflows/frontend.yml`, workflow `Frontend CI`)

  An admin can apply it via Settings → Branches / Rulesets, or equivalently:

  ```
  gh api -X PUT repos/undp/monbo/branches/main/protection --input - <<'JSON'
  {
    "required_status_checks": {
      "strict": true,
      "contexts": ["Test and static checks", "Type-check, lint, build"]
    },
    "enforce_admins": false,
    "required_pull_request_reviews": null,
    "restrictions": null
  }
  JSON
  ```

  After applying it, confirm a failing check actually blocks merge before closing this task.
- [x] 1.16 Configure workflow triggers: `types: [opened, synchronize, ready_for_review]` + `if: github.event.pull_request.draft == false`
- [x] 1.17 Update root, `monbo-api`, `monbo-front`, and `scripts` READMEs for uv + orchestrator + workflow
- [x] 1.18 Give every `dev` dependency-group entry in `monbo-api/pyproject.toml` an exact `==` pin (ruff, black, mypy, memory-profiler), matching the style of the production deps; pin them at the versions the committed lock already resolved (mypy 2.2.0, black 26.5.1, ruff 0.15.20) so this is a no-op for the current CI run. Rationale in design D9: unpinned linters let an unrelated `uv lock` refresh in PRs 2-5 re-roll the toolchain and fail CI for reasons unrelated to the bump under review, and it is how mypy 1 → 2 and black 25 → 26 landed without appearing in any PR's scope
- [x] 1.19 Record the resolved `pandas` version in the `tooling` block of `monbo-api/tests/numeric_baseline/baseline.json` and in `generate_baseline.py`'s version capture, alongside numpy/geopandas/rasterio/pyproj/shapely/pillow. The PR 1 lock pulled pandas 3.0.3 transitively through geopandas (which caps nothing above `pandas>=2.0.0`), so a pandas major is currently in the dependency graph with no record in the baseline — see design R8

## 2. PR 2 — API minors (Python track; lands after PR 4a)

**Branch:** `chore/api-deps-minors` — **Title:** `chore(deps): bump API minors (shapely, geopandas, pyproj, uvicorn…)`

- [x] 2.1 Bump shapely 2.1.2, geopandas 1.1.4, pyproj 3.8.0, uvicorn 0.53.0, colorlog 6.12.0, python-dotenv 1.2.3 (keep rasterio 1.4.3 until PR 4b); refresh `uv.lock`. pyproj 3.8.0 requires Python >= 3.12 and publishes no cp311 wheel, which is why this PR lands after PR 4a — on the original ordering it would have had to settle for 3.7.2
- [x] 2.1b Expect a small numeric drift from pyproj and attribute it explicitly. Measured 2026-09-22 against the production rasters: the polygon path is bit-identical, but the **point-with-radius path drifts ~3.6e-10 relative** (0.07030155911922976 → 0.0703015591443049 on `gfw.tif`), isolated to pyproj 3.7.2 → 3.8.0 by holding the interpreter and numpy constant. That is three orders of magnitude inside the gate's 1e-6 tolerance, and it is consistent with 3.8.0 bundling a newer PROJ that changes the geodesic buffer. Record the before/after values in the PR rather than letting the gate pass silently
- [x] 2.2 Run `uv run pytest` and smoke `/health` + a deforestation analysis — done 2026-09-22 on top of PR 4a: 31 tests pass including the numeric gate, ruff/black/mypy clean, `/health` 200, `POST /analize` 200 over `gfw.tif` and `tmf.tif` for a polygon and a point-with-radius farm, and the tile endpoint returning a 256x256 RGBA PNG byte-identical to the pre-bump render. The lock delta is exactly the six intended packages, with no transitive movement

## 3. PR 3 — API nominal majors (Python track; lands after PR 2, before PR 4b)

**Branch:** `chore/api-deps-majors` — **Title:** `chore(deps): bump API majors (pillow 12, pytest 9, pycountry 26, fastapi 0.141)`

- [x] 3.1 Bump pillow 12.3.0, pytest 9.1.1 + pytest-cov 7.1.0, pycountry 26.2.16, fastapi 0.141.1; refresh `uv.lock`
- [x] 3.1b Account for the transitive movement fastapi drags in — this bump is not confined to the five named packages. `starlette` crosses **0.41.3 → 1.6.0**, a 0.x → 1.0 major that no task named, and `fastapi-cli` 0.0.29 → 0.0.32 plus two new transitive packages (`pydantic-extra-types` 2.11.1, `pydantic-settings` 2.15.0) arrive with `fastapi[standard]`. Per design R8 and task 12.6 the crossing is recorded rather than absorbed silently; validated by the full suite, the numeric gate and an end-to-end smoke rather than assumed safe because FastAPI pins it
- [x] 3.2 Confirm no removed pillow APIs are used and there is no `on_event` usage (Pydantic already v2); run pytest — done 2026-09-22. Pillow: the codebase uses only `Image.new`, `Image.fromarray`, `Image.alpha_composite`, `.convert`, `.resize`, `ImageDraw.Draw` and `Image.Image` type hints, and already uses the modern `Image.Resampling.LANCZOS` enum rather than the removed `Image.ANTIALIAS`/`Image.LANCZOS` constants; no `textsize`, `getsize`, `tostring` or `fromstring` anywhere. FastAPI: no `on_event` usage at all. pytest 9: no `conftest.py`, no pytest-asyncio (the async paths call `asyncio.run` directly) and the only config is `testpaths`, so nothing depends on the collection behaviour pytest 9 changes. pycountry 26: `countries.get(alpha_2=...)` still resolves CL/EC/CO/PE/BR/CR and still returns `None` for an invalid code, which is what the validator branches on.
  Results: 31 tests pass including the numeric gate; ruff, black and mypy clean; `/health` 200, `POST /analize` 200 returning values **identical** to PR 2, the tile endpoint returning a PNG **byte-identical** to the PR 2 render under Pillow 12, and the maps router reachable.
- [ ] 3.3 Decide what to do about the `httpx` → `httpx2` deprecation that starlette 1.6 introduces. Importing `fastapi.testclient` now emits `StarletteDeprecationWarning: Using httpx with starlette.testclient is deprecated; install httpx2 instead`. It is non-blocking today — starlette 1.6's `full` extra still accepts `httpx>=0.27,<0.29` alongside `httpx2>=2.0.0` — but the project pins `httpx==0.28.1` as a direct dependency and uses it in `app/utils/image_generation/GoogleMapsAPIHelper.py` (`AsyncClient`, `RequestError`), so migrating means changing both the pin and that call site. Out of scope for this PR; see the deferred list

## 4a. PR 4a — Python 3.13 runtime only (Python track; lands right after PR 1, before PR 2)

**Branch:** `chore/api-python-3.13` — **Title:** `build: raise API runtime to Python 3.13`

> Resequenced 2026-09-22. D3 originally coupled the interpreter bump to rasterio 1.5 and put both at the end of the Python track. The coupling only runs one way: rasterio 1.5 needs Python >= 3.12, but Python 3.13 does not need rasterio 1.5 — rasterio 1.4.3 publishes cp313 wheels. Verified by resolving and running the full suite at 3.13 with rasterio pinned to 1.4.3. Splitting the interpreter out and moving it ahead of the dependency PRs unblocks pyproj 3.8.0 (PR 2) and geemap (PR 5), collapses the lock's dual numpy resolution into a single version, and leaves rasterio 1.5 as a one-variable PR (4b). See design D3 and R10 for the rollback trade-off this creates.

- [x] 4a.1 Raise `.python-version` and `requires-python` to 3.13; set `python:3.13-slim` in both API Dockerfiles. Revised 2026-09-22 (design D3): the original 3.12 target is superseded — 3.12 has been security-only since April 2025, 3.13 is the current bugfix line, and the whole geospatial stack publishes cp313 wheels (verified for rasterio 1.4.3 and 1.5.1, pyproj 3.8.0, shapely 2.1.2, numpy 2.5.3, pillow 12.3.0; geopandas is pure Python, pyogrio ships abi3)
- [x] 4a.2 Verify and update any hardcoded versioned paths (e.g. `/usr/local/lib/python3.11/site-packages`) in `monbo-api/Dockerfile.prod`'s multi-stage `COPY --from=api-builder` step — confirmed already gone after the uv rewrite in PR 1: the build stage produces a self-contained environment at `/opt/venv` and the runner copies that path, with no interpreter version in it
- [x] 4a.3 Keep rasterio at 1.4.3 and refresh `uv.lock`; record the resolved numpy and pandas versions. Result: numpy collapses from the dual resolution (2.4.6 below 3.12, 2.5.1 at or above) to a single **2.5.1**, pandas stays **3.0.3**, and `tomli` drops out — 79 packages, down from 81. The numpy 2.4 → 2.5 crossing therefore happens here, isolated from every dependency bump
- [x] 4a.4 Raise mypy `python_version` 3.10 → 3.13 in the authoritative `monbo-api/pyproject.toml`; the duplicate root `[tool.mypy]` block was orphaned — nothing invokes mypy from the repo root, since both the orchestrator script and CI run it with `--directory monbo-api` — so it was removed rather than consolidated. The root `[tool.black]` `target-version` was aligned to `py313` at the same time so no file in the repo still claims 3.11. Updated `monbo-api/README.md` and `docs/onboarding.md`
- [x] 4a.5 Replace the deprecated `datetime.utcnow()` calls that Python 3.13 surfaces as `DeprecationWarning` in the tile handler (`app/modules/deforestation_analysis/router.py`) with timezone-aware `datetime.now(timezone.utc)`; the rendered HTTP date strings are unchanged
- [x] 4a.6 Hard gate: run the full pytest suite and the automated numeric fixture against the Python 3.13 lock. Result on macOS arm64: 31 passed, ruff/black/mypy clean, and the production-raster smoke (`gfw.tif` + `tmf.tif`, polygon and point-with-radius) returns ratios **identical to the last digit** versus Python 3.11 / numpy 2.4.6. The interpreter and numpy bump are numerically neutral
- [ ] 4a.7 Re-confirm the gate on Linux x86_64 in CI, which is the blocking reference platform; the local run above is informative only

## 4b. PR 4b — rasterio 1.5 (Python track; after PR 3)

**Branch:** `chore/api-rasterio-1.5` — **Title:** `build: upgrade rasterio to 1.5 (numpy 2)`

- [x] 4b.1 Bump rasterio to 1.5.1 and refresh `uv.lock`; record the resolved numpy and pandas versions and confirm nothing else moved — done 2026-09-22. numpy stays **2.5.1** and pandas **3.0.3**, both already established in PR 4a. The only other movement is rasterio dropping its CLI-only dependencies `click-plugins` 1.1.1.2 and `cligj` 0.7.2, neither of which the codebase imports (79 → 77 packages)
- [x] 4b.2 Hard gate: on Linux x86_64, run the repaired full pytest suite and the automated PR 1 numeric fixture against the rasterio 1.5.1 lock; block unless ratios, raster metadata/masks/pixels, and decoded rendered imagery satisfy the exact tolerances in `python-dependency-toolchain`. This PR carries a single variable — the interpreter and numpy crossings were validated in PR 4a — so any drift the gate reports is attributable to rasterio. Result: **no drift at all.** 31 tests pass including the gate; against the production rasters all four deforestation ratios are identical to PR 3 to the last digit, and the rendered tile is byte-identical, as is the empty-tile (no-overlap) branch. The split paid off here: because rasterio is the only moving part, "identical" is an attributable result rather than a coincidence of three changes cancelling out
- [x] 4b.3 Update the numeric-gate guard in `tests/test_numeric_baseline.py` that asserts the baseline was captured under rasterio 1.4.x, if it still describes the pre-upgrade reference correctly after this bump — reviewed and **deliberately left unchanged**. The guard describes the baseline's capture environment, not the runtime, and the baseline genuinely was captured under rasterio 1.4.3. Loosening it to accept 1.5.x would defeat its purpose: it exists so that regenerating the expected values under the candidate environment cannot pass as evidence of compatibility, and after this bump it guards against exactly that for rasterio as well as numpy
- [x] 4b.4 Drop the deprecated `precision` argument that the codebase passes to `vrt.window()` in `app/modules/deforestation_analysis/helpers.py`. rasterio emits `RasterioDeprecationWarning: The precision parameter is unused, deprecated, and will be removed in 2.0.0` on every tile request; since rasterio itself documents the parameter as unused, removing it is behaviourally inert — confirmed by capturing the production-raster ratios and the decoded tile hash with and without it on the same rasterio 1.5.1 build, which match exactly. Removing it now clears the warning and avoids a hard break at rasterio 2

## 5. PR 5 — Script GFW/TMF (Python track)

**Branch:** `chore/gfw-tmf-deps` — **Title:** `chore(deps): update GFW/TMF script (uncap tenacity, bump earthengine/geemap)`

- [ ] 5.1 Raise the script's `requires-python` floor before bumping anything, aligning it with the API's 3.13 interpreter established in PR 4a. `scripts/update-gfw-tmf/pyproject.toml` declares `>=3.9`, which is loose enough that uv forks the lock three ways — the committed lock installs geemap 0.36.6 on Python 3.9, 0.37.2 on 3.10-3.11 and 0.38.3 on 3.12+ — so the script already runs different code depending on which interpreter the developer happens to have. Verify the refreshed lock resolves a single version per package
- [ ] 5.2 Remove the `tenacity<9` cap (current release 9.1.4; the script lock is still on 8.5.0) and bump earthengine-api to 1.7.45 and geemap to 0.38.5 (the script lock is on 1.7.34 / 0.38.3; note geemap has required Python >= 3.12 since 0.37.3, which is why 5.1 comes first); refresh `uv.lock`
- [ ] 5.3 Validate with a bounded run + `gdalinfo` on the output

## 6. PR 6 — Front minors (Front track)

**Branch:** `chore/front-deps-minors` — **Title:** `chore(deps): bump frontend minors (react 19.2, date-fns, lodash…)`

- [ ] 6.1 Bump react/react-dom 19.3.0 together with `@types/react` and `@types/react-dom` 19.3.0 in the same commit
- [ ] 6.2 Bump @react-pdf/renderer 4.9.0, @vis.gl/react-google-maps 1.10.1, date-fns 4.4.0, fuse.js 7.5.0, lodash 4.18.1 (+ `@types/lodash` 4.17.25), @googlemaps/markerclusterer 2.6.2, @fontsource/roboto 5.3.0, @emotion/styled 11.14.1, next-i18n-router 5.5.8, @eslint/eslintrc 3.3.7, and the two dependencies the original plan omitted — jszip 3.10.2 and i18next-resources-to-backend 1.2.3; refresh `pnpm-lock.yaml`
- [ ] 6.3 Run `tsc --noEmit` + lint + build

## 7. PR 7 — Front toolchain (Front track; lands after PR 8 and precedes PR 9)

**Branch:** `chore/front-toolchain-ts6-eslint10` — **Title:** `chore(deps): upgrade frontend toolchain (TypeScript 6.0.3 + eslint 10)`

- [ ] 7.1 Bump TypeScript to **6.0.3** — the head of the v6 line, and the newest version this stack can lint with. Do not track `latest`: TypeScript 7.0.2 has been `latest` since 2026-07-08, but `eslint-config-next@16.3.6` depends on `typescript-eslint@^8.46.0`, and every published typescript-eslint release (canary included) caps `peerDependencies.typescript` at `<6.1.0`, so TS 7 breaks the blocking lint step. TS 7 is deferred with an explicit entry condition — see design D10
- [ ] 7.2 After PR 8 has landed and established Node 24 in local/Docker/CI metadata, bump eslint to 10.11.0 (requires Node 20.19 / 22.13 / 24+); do not merge this PR onto the prior Node 20 baseline
- [ ] 7.3 Align `@types/node` to 24.x matching the real runtime (NOT 26 — its `latest` is 26.6.2 and would describe an interpreter the project does not run); refresh `pnpm-lock.yaml`
- [ ] 7.4 Run `tsc --noEmit` + lint + build

## 8. PR 8 — Next 16 + Node 24 (Front track; lands before PR 7 and PR 10)

**Branch:** `chore/front-next16-node24` — **Title:** `build: upgrade frontend to Next 16 + Node 24`

> Revised 2026-09-22 (design D4): the runtime target is **Node 24**, not 22. Node 22 left active LTS on 2025-10-21 and is in maintenance until 2027-04-30; Node 24 is the active LTS (EOL 2028-04-30). Shipping 22 now would land the project on a maintenance-only runtime for the same amount of work. Nothing blocks 24 — next 16.3.6 needs >=20.9, eslint 10.11.0 needs ^20.19 || ^22.13 || >=24, concurrently 10 and react-dropzone 20 need >=22.

- [ ] 8.1 Bump next 16.3.6 + eslint-config-next 16.3.6
- [ ] 8.2 Set `node:24-alpine` in both frontend Dockerfiles; add `engines` (Node >=24) to `monbo-front/package.json`
- [ ] 8.3 In `monbo-front/Dockerfile.dev` and `monbo-front/Dockerfile.prod`, stop installing a mutable global pnpm; enable Corepack, use the exact pnpm version from `packageManager`, and install dependencies with `pnpm install --frozen-lockfile`. In the same PR, refresh the `packageManager` pin itself in both `monbo-front/package.json` and the root `package.json`: both sit at pnpm 10.26.1 and the current release is 12.5.1, two majors behind — the original plan never scheduled a pnpm bump
- [ ] 8.4 Change lint script `next lint` → `eslint .` (next lint removed in 16)
- [ ] 8.5 Remove `--turbo` from the dev script (Turbopack is default); confirm `next build --webpack` fallback works
- [ ] 8.6 Evaluate/apply the middleware→proxy codemod for `src/middleware.tsx`
- [ ] 8.7 Manually verify `output: "standalone"` by running `postbuild` + `start:standalone`, exercising a rendered page, and confirming MUI SSR styling; record the result in PR 8 (this is an acceptance check, not a frontend CI workflow step)
- [ ] 8.8 Confirm pages still use `await params/searchParams` (already verified); run the CI-equivalent `pnpm install --frozen-lockfile` + `tsc --noEmit` + lint + build
- [ ] 8.9 Raise the frontend workflow's `actions/setup-node` pin from Node 22 to Node 24 so CI validates on the runtime the app actually ships on. The Node 22 pin set in task 1.9 was a deliberate bootstrap value (it only had to clear eslint 10's >=22.13 floor); this task closes the gap. Also bump the root orchestrator's `concurrently` 10.0.3 → 10.0.5 while the lockfile is being refreshed

## 9. PR 9 — i18n majors (Front track; after PR 7)

**Branch:** `chore/front-i18next-26` — **Title:** `chore(deps): upgrade i18next 26 + react-i18next 17`

- [ ] 9.1 Bump i18next 26.4.2 + react-i18next 17.0.15 together (peer `i18next >= 26.2`); refresh `pnpm-lock.yaml`
- [ ] 9.2 Fix the usages of `TFunction` (8 files, verify with grep at implementation time): `src/components/page/deforestationAnalysis/DeforestationResultsTable.tsx`, `src/components/page/polygonsValidation/InconsistentFarmsTable.tsx`, `src/components/page/polygonsValidation/DownloadPageData.tsx`, `src/components/page/polygonsValidation/GeometryInconsistencyModal.tsx`, `src/components/page/polygonsValidation/OverlapInconsistencyModal.tsx`, `src/utils/deforestationReport.tsx`, `src/utils/deforestationReport/sections.tsx`, `src/utils/excel.ts`
- [ ] 9.3 Run `tsc --noEmit`; exhaustive es↔en smoke of all flows

## 10. PR 10 — Front small majors + MUI 7 (Front track)

**Branch:** `chore/front-mui7` — **Title:** `chore(deps): upgrade MUI 7 + small majors (react-dropzone 20, p-limit 7)`

> Revised 2026-09-22: `react-dropzone` is now at 20.1.2 — six majors above the installed 14.3.8, not the one the original plan assumed. It also declares `engines.node >=22`, so this PR now depends on PR 8 as well.

- [ ] 10.1 Bump react-dropzone to 20.1.2 and p-limit to 7.3.3 (only `pLimit(20)` used). The react-dropzone surface in use is narrow — `Accept`, `FileRejection` and `useDropzone` across `src/components/reusable/DropZone.tsx` and `src/components/page/uploadData/UploadFileStep.tsx`, and no `isDragReject` — so a direct jump is plausible, but read the 15→20 changelogs for those three exports before assuming it; requires Node >=22, so it must land after PR 8
- [ ] 10.2 Run the official MUI 6 → 7 codemod, targeting 7.3.11 (the current head of the v7 line; v9.4.0 is `latest` but stays deferred pending a visual-regression harness)
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
- [ ] 12.2 API smoke: `/health` + deforestation analysis numbers/imagery vs the version-controlled reference case (re-confirm after PR 4, which crosses numpy 2.4 → 2.5 on top of the interpreter bump)
- [ ] 12.3 Re-confirm the separate PR 8 manual `postbuild` + `start:standalone` verification and MUI SSR result; do not report it as a CI step
- [ ] 12.4 Front manual smoke of 4 flows in es and en: home/country selection; polygon validation with upload + Excel/GeoJSON downloads; deforestation analysis with map/clusters/modals; PDF report
- [ ] 12.5 Verify deferred items remain untouched and documented as out-of-scope, with the revised 2026-09-22 list: MUI 9 (pending a visual-regression harness), TypeScript 7 (pending typescript-eslint peer support), Turborepo (pending a second JS package), Python 3.14 / Node 26 (this cycle lands on 3.13 / 24), and xlsx 0.18.5 (npm still serves 0.18.5 as `latest`, so the security debt is unchanged and remediation still means changing channel or library)
- [ ] 12.6 Confirm no unscheduled major slipped in through a transitive resolution the way pandas 2 → 3 did in PR 1 (design R8): diff the final `uv.lock` and `pnpm-lock.yaml` against the pre-change state and account for every major-version jump, whether or not a task named it
