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

## 2. PR 2 — API minors (Python track)

**Branch:** `chore/api-deps-minors` — **Title:** `chore(deps): bump API minors (shapely, geopandas, pyproj, uvicorn…)`

- [ ] 2.1 Bump shapely 2.1.2, geopandas 1.1.4, pyproj 3.8.0, uvicorn 0.53.0, colorlog 6.12.0, python-dotenv 1.2.3 (keep rasterio 1.4.3 until PR 4); refresh `uv.lock`
- [ ] 2.2 Run `uv run pytest` and smoke `/health` + a deforestation analysis

## 3. PR 3 — API nominal majors (Python track)

**Branch:** `chore/api-deps-majors` — **Title:** `chore(deps): bump API majors (pillow 12, pytest 9, pycountry 26, fastapi 0.141)`

- [ ] 3.1 Bump pillow 12.3.0, pytest 9.1.1 + pytest-cov 7.1.0, pycountry 26.2.16, fastapi 0.141.1; refresh `uv.lock`
- [ ] 3.2 Confirm no removed pillow APIs are used and there is no `on_event` usage (Pydantic already v2); run pytest

## 4. PR 4 — Python 3.13 + rasterio 1.5 (Python track, runtime gate)

**Branch:** `chore/api-python-3.13` — **Title:** `build: raise API runtime to Python 3.13 + rasterio 1.5 (numpy 2)`

- [ ] 4.1 Raise `.python-version` and `requires-python` to 3.13; set `python:3.13-slim` in both API Dockerfiles. Revised 2026-09-22 (design D3): the original 3.12 target is superseded — 3.12 has been security-only since April 2025, 3.13 is the current bugfix line, and the whole geospatial stack publishes cp313 wheels (verified for rasterio 1.5.1, pyproj 3.8.0, shapely 2.1.2, numpy 2.5.3, pillow 12.3.0; geopandas is pure Python, pyogrio ships abi3), so the gate work is identical either way
- [ ] 4.2 Verify and update any hardcoded versioned paths (e.g. `/usr/local/lib/python3.11/site-packages`) in `monbo-api/Dockerfile.prod`'s multi-stage `COPY --from=api-builder` step; this path may already be gone after the uv rewrite in PR 1 — confirm and update to `python3.13` if it is still present
- [ ] 4.3 Bump rasterio to 1.5.1 and refresh `uv.lock`; explicitly verify the selected numpy **and pandas** versions. numpy 2 was already present in the PR 1 lock, so this is not its first introduction — but that lock is a dual resolution (numpy 2.4.6 below Python 3.12, 2.5.x at or above it), so raising the interpreter also crosses numpy 2.4 → 2.5, a minor the baseline has never been validated against. Record both resolved versions in the PR description
- [ ] 4.4 Raise mypy `python_version` 3.10 → 3.13 in the authoritative `monbo-api/pyproject.toml`; remove the duplicate root `[tool.mypy]` block if it is orphaned, or consolidate to one shared authoritative configuration if a root invocation is retained; update README
- [ ] 4.5 Hard gate: on Linux x86_64, run the repaired full pytest suite and the automated PR 1 numeric fixture against the Python 3.13/rasterio 1.5.1 lock; block unless ratios, raster metadata/masks/pixels, and decoded rendered imagery satisfy the exact tolerances in `python-dependency-toolchain`. Treat this as a genuine re-validation, not a repeat of PR 1's run: the interpreter bump moves numpy from 2.4.6 to the 2.5 series and may move pandas as well (see 4.3 and design R8)

## 5. PR 5 — Script GFW/TMF (Python track; independent of the API chain)

**Branch:** `chore/gfw-tmf-deps` — **Title:** `chore(deps): update GFW/TMF script (raise Python floor, uncap tenacity, bump earthengine/geemap)`

> Branched off PR 1 rather than off the API chain. `scripts/update-gfw-tmf` has its own `pyproject.toml` and `uv.lock` and shares no code with `monbo-api`, so stacking it behind PRs 4a/2/3/4b would add review debt for no dependency reason. It can merge as soon as PR 1 does.

- [x] 5.1 Raise the script's `requires-python` floor to 3.13, matching `monbo-api`, and verify the refreshed lock resolves a single version per package — done 2026-09-22, and the problem was materially worse than the plan recorded. Under the previous `>=3.9` floor uv forked the resolution across **29 packages**, not just geemap: geemap resolved to 0.36.6 / 0.37.2 / 0.38.3 and **numpy to four different versions** (2.0.2, 2.2.6, 2.4.6, 2.5.1) depending on the operator's interpreter, along with earthengine-api, cryptography, google-auth, click, contourpy and 23 others. Since this script generates the raster files the API's deforestation analysis reads, that is silent drift in the data pipeline itself. After the floor raise: **zero forked packages**
- [x] 5.2 Remove the `tenacity<9` cap and bump earthengine-api and geemap; refresh `uv.lock` — done. tenacity 8.5.0 → **9.1.4**, earthengine-api 1.6.15/1.7.34 → **1.7.45**, geemap 0.36.6/0.37.2/0.38.3 → **0.38.5**, all now exactly pinned rather than left as open floors. Verified against the script's actual call sites rather than assumed: `ee.Initialize(project=)`, `ee.FeatureCollection`, `ee.Filter.inList`, `ee.Image`, `ee.ImageCollection`, `ee.Feature` and `geemap.ee_export_image` all still exist, and `ee_export_image` still accepts `filename`, `scale`, `region` and `file_per_band`. The script's exact `@retry(stop=stop_after_attempt(3), wait=wait_exponential(...), reraise=True)` decorator was executed under tenacity 9 and still makes 3 attempts and re-raises the original exception
- [ ] 5.3 Validate with a bounded run + `gdalinfo` on the output — **NOT DONE; needs an operator environment.** A bounded run requires two things unavailable here: Earth Engine credentials with a GCP project ID (`earthengine authenticate` plus `config.py`), and a system libgdal matching the locked GDAL binding (see 5.4). Everything reachable without them was verified instead: the lock resolves, the environment installs cleanly with `--no-install-package gdal`, and the full earthengine/geemap/tenacity API surface the script uses was exercised. The GDAL-dependent part is only the final `gdal.BuildVRT` / `gdal.Translate` step, so it is the VRT output specifically that remains unvalidated
- [ ] 5.4 Decide how to handle the GDAL version-matching trap this PR surfaced. The Python `GDAL` bindings only build against a system `libgdal` of the same version, but `pyproject.toml` declares an open `GDAL>=3.6.0`, so `uv.lock` pinned whatever was newest at lock time — 3.13.1. On a host with libgdal 3.7.3 `uv sync` fails outright with `Python bindings of GDAL 3.13.1 require at least libgdal 3.13.1`, which means the committed lock is uninstallable for anyone whose system GDAL is older. This predates the PR (it arrived with PR 1's uv migration) and is documented in the README for now with a workaround, but a real fix is a decision: standardise the team on one system GDAL, containerise the script the way the API is, or move `GDAL` out of the locked set and treat it as an environment prerequisite

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

> Branched off PR 1 rather than off the frontend chain, like PR 5. It touches only `.github/dependabot.yml` and the READMEs, so it can merge as soon as PR 1 does.

- [x] 11.1 Add `.github/dependabot.yml` (`version: 2`) with a weekly `schedule.interval` for every ecosystem/directory — seven entries: `npm` (`/` for the root orchestrator and `/monbo-front`), `uv` (`/monbo-api` and `/scripts/update-gfw-tmf`), `docker` (`/monbo-api` and `/monbo-front`), `github-actions` (`/`). Days are staggered Monday–Thursday so one ecosystem's PRs don't all land at once. Validated by parsing the file: 7 entries, no duplicate ecosystem/directory pair
- [x] 11.2 Group minor/patch updates per ecosystem (`groups`) and keep majors separate; set `open-pull-requests-limit` to bound the queue; do not enable automerge. Majors are kept separate by *omission* — the single `minor-and-patch` group claims only `update-types: ["minor", "patch"]`, so every major falls outside it and gets its own PR. Confirmed by parsing that the config contains no `automerge` key anywhere
- [x] 11.3 Verify the `uv` ecosystem updates `pyproject.toml` and `uv.lock` in sync — **both defects the plan flagged are resolved upstream.** dependabot-core #12788 (uv.lock updated without pyproject.toml) closed 2025-12-05; #13426 (security updates run through pip instead of uv) closed 2026-01-14. The ecosystem identifier is confirmed as `"uv"` from `uv/lib/dependabot/uv/package_manager.rb` (`ECOSYSTEM = "uv"`). Since `monbo-api` pins with `==`, the first few PRs should still be spot-checked for both files moving together
- [x] 11.4 Confirm the Docker entries detect both non-standard filenames, `Dockerfile.dev` and `Dockerfile.prod` — **they are covered.** Verified against dependabot-core's source rather than by a test PR (which needs the config on the default branch, and therefore admin access this change does not have): `docker/lib/dependabot/docker/file_fetcher.rb` defines `DOCKER_REGEXP = /dockerfile|containerfile/i` and selects candidates with `f.name.match?(filename_regex)` — a case-insensitive *substring* match, so both names qualify. Worth noting the widely-cited claim that Dependabot only detects files named exactly `Dockerfile` is out of date; the issues behind it (#428, #4449) were closed years ago
- [x] 11.5 Decide and document whether the `ghcr.io/astral-sh/uv` image used by `COPY --from` is in Docker-update scope — **it is not, confirmed from source.** `docker/lib/dependabot/docker/file_parser.rb` builds `FROM_LINE` as `%r{^#{FROM}\s+...}` and skips any line that does not match, so `COPY --from=ghcr.io/astral-sh/uv:0.11.21` is invisible to it. Recorded as a manual bump, and the README now names all **three** places the version must stay in sync: `monbo-api/Dockerfile.dev`, `monbo-api/Dockerfile.prod`, and the `astral-sh/setup-uv` `version:` input in `.github/workflows/api.yml`. Drift there means the image and CI resolve dependencies with different uv versions — precisely what `--frozen` is meant to rule out
- [x] 11.6 Evaluate pinning every third-party GitHub Action to a full commit SHA instead of mutable `@vN` tags; adopt it or record the risk-based decision, and verify Dependabot can continue updating the chosen form — **already adopted in PR 1** (commit `ci: pin GitHub Actions to commit SHAs`). All five actions in use carry a full SHA with a `# vX.Y.Z` comment. Dependabot understands that form: it bumps the SHA and rewrites the comment, so SHA pinning and automated updates are not in tension
- [x] 11.7 Update READMEs to document the Dependabot policy — root README gains a "Dependency update policy" section with the full coverage table and both caveats; `monbo-api`, `monbo-front` and the GFW/TMF script READMEs gain pointers, with the API one spelling out the manual uv-binary sync and the script one noting that a proposed GDAL bump still has to clear the system `libgdal` match (R11)
- [ ] 11.8 Verify with a real Dependabot run once this is on the default branch. Everything above was verified from dependabot-core's source, which is stronger than guessing but is not the same as watching the bot actually open a PR. Dependabot only reads `.github/dependabot.yml` from the default branch, so this cannot be exercised before merge. After merging, confirm: seven ecosystems are picked up (repo Insights → Dependency graph → Dependabot), the `uv` entries move `pyproject.toml` and `uv.lock` together, and the Docker entries actually propose base-image bumps for the `.dev`/`.prod` filenames
- [ ] 11.9 Consider adding a `cooldown` to the npm and uv entries. Not added here because it is a policy choice rather than a mechanical one, but the case is on record: pnpm 12's default `minimumReleaseAge` rejected a transitive published the same morning (R14), and Dependabot's `cooldown` option is the same idea expressed in the bot's own configuration. Adopting it would reduce exposure to a compromised package published and immediately pulled

## 12. Cross-cutting validation and close-out

- [ ] 12.7 Remove the build-time network dependency on Google Fonts. Surfaced on 2026-09-23 when the frontend job failed on a PR that changed only YAML and Markdown: `An error occurred in next/font. TypeError: Cannot read properties of null (reading '1')` from `next@15.3.1`'s Google font loader. It passed on rerun, so it was transient — but the underlying fact is not: `src/app/layout.tsx` loads Roboto through `next/font/google`, which **downloads the font from Google at build time**, so `pnpm build` and therefore CI can fail for reasons that have nothing to do with the change under review. A CI that fails at random is a CI people stop reading.
  The fix is already paid for: **`@fontsource/roboto` is declared in `monbo-front/package.json` and imported nowhere** — a self-hosted copy of the same font, sitting unused. (PR 6 dutifully bumped it 5.2.5 → 5.3.0, updating a dependency nothing imports.) Switching `layout.tsx` to the self-hosted package removes the network call entirely. Left out of PR 11 because it changes how the font is loaded — `font-display`, subsetting and the `--font-roboto` CSS variable wiring all need checking — and that is a rendering change, not a dependency bump.
- [ ] 12.1 Confirm blocking CI green with no `continue-on-error` (frontend: install --frozen-lockfile + tsc --noEmit + lint + build; API: uv sync --frozen + uv run pytest, including the numeric fixture, + ruff/black/mypy) and re-confirm branch protection requires both jobs
- [ ] 12.2 API smoke: `/health` + deforestation analysis numbers/imagery vs the version-controlled reference case (re-confirm after PR 4, which crosses numpy 2.4 → 2.5 on top of the interpreter bump)
- [ ] 12.3 Re-confirm the separate PR 8 manual `postbuild` + `start:standalone` verification and MUI SSR result; do not report it as a CI step
- [ ] 12.4 Front manual smoke of 4 flows in es and en: home/country selection; polygon validation with upload + Excel/GeoJSON downloads; deforestation analysis with map/clusters/modals; PDF report
- [ ] 12.5 Verify deferred items remain untouched and documented as out-of-scope, with the revised 2026-09-22 list: MUI 9 (pending a visual-regression harness), TypeScript 7 (pending typescript-eslint peer support), Turborepo (pending a second JS package), Python 3.14 / Node 26 (this cycle lands on 3.13 / 24), and xlsx 0.18.5 (npm still serves 0.18.5 as `latest`, so the security debt is unchanged and remediation still means changing channel or library)
- [ ] 12.6 Confirm no unscheduled major slipped in through a transitive resolution the way pandas 2 → 3 did in PR 1 (design R8): diff the final `uv.lock` and `pnpm-lock.yaml` against the pre-change state and account for every major-version jump, whether or not a task named it
