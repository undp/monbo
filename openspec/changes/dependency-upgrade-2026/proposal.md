## Why

The Monbo monorepo runs on runtimes and dependencies that are past end-of-life: `node:20-alpine` has been EOL since 2026-04-30, the API is pinned to Python 3.11 via a hand-maintained `requirements.txt` (with a duplicated `fastapi` + `fastapi[standard]` entry), and there is no CI or automated dependency tooling to catch regressions or drift. This change modernizes the dependency stack, runtimes, and build tooling across both tracks (Python API + scripts, and the Next.js frontend) and puts guardrails in place — CI immediately, and an automated dependency bot (Dependabot) as the final step — so the project stays current with low ongoing effort.

## What Changes

- Migrate `monbo-api` and `scripts/update-gfw-tmf` from `pip`/`requirements.txt` to **uv** (`pyproject.toml` + `uv.lock` + dependency-groups); remove `requirements.txt` and the duplicated `fastapi`/`fastapi[standard]` entry. **BREAKING** for local dev and Docker install steps.
- Add a **root `package.json` orchestrator** ("option A"): scripts delegate with `pnpm --dir` / `uv run --directory` plus a pinned root `concurrently` devDependency for parallel dev. The root `pnpm-lock.yaml` records only orchestrator dependencies; package lockfiles remain in place and no `pnpm-workspace` is introduced. pnpm is retained for the frontend.
- Raise the **runtime baseline**: API to **Python 3.12** (enabling **rasterio 1.5** + **numpy 2**); frontend to **Node 22 LTS**; Docker base images to `python:3.12-slim` and `node:22-alpine`. **BREAKING** runtime bump.
- Upgrade **API dependencies**: minors (shapely, geopandas, pyproj, uvicorn, colorlog, python-dotenv) and nominal majors (pillow 12, pytest 9 + pytest-cov 7, pycountry 26, fastapi 0.139); un-cap `tenacity<9` and bump earthengine-api/geemap in the GFW/TMF script.
- Upgrade **frontend dependencies**: minors (react 19.2, @react-pdf/renderer, @vis.gl/react-google-maps, date-fns, fuse.js, lodash, markerclusterer, i18n helpers, etc.), toolchain majors (**TypeScript 6.0**, **eslint 10**, **Next 16**), i18n majors (**i18next 26 + react-i18next 17**), small majors (react-dropzone 15, p-limit 7) and **MUI 6 → 7**. **BREAKING** for `next lint` removal, `--turbo` flag, and MUI codemod changes.
- Add **CI** (GitHub Actions) for both tracks, triggered on draft→ready (PR 1). API checks may be report-only only during the documented bootstrap stage; repairing the inherited pytest/static-check failures, establishing the numeric baseline, removing `continue-on-error`, and enabling required branch-protection checks are acceptance work, not deferred guardrails.
- Add an automated dependency bot — **Dependabot** (`.github/dependabot.yml`) — as the **final, standalone PR**: weekly schedule, grouped minors/patches, separate major PRs, no automerge, bounded by `open-pull-requests-limit`, covering both pnpm lockfiles, the `uv.lock` files, verified non-standard Dockerfile names, and GitHub Actions. Deferred to last as the lowest-priority guardrail.
- Update READMEs to reflect uv, the root orchestrator, and the new runtimes.

## Capabilities

### New Capabilities
- `python-dependency-toolchain`: uv-based dependency management for `monbo-api` and `scripts/update-gfw-tmf` — `pyproject.toml` + committed `uv.lock` + dependency-groups, `.python-version`, frozen installs in Docker, and the Python 3.12 / rasterio 1.5 / numpy 2 runtime baseline.
- `frontend-dependency-toolchain`: pnpm-managed frontend on Node 22 LTS with `engines`/`packageManager` pinning, Next 16 build/lint behavior, and the upgraded dependency set (incl. MUI 7).
- `monorepo-orchestration`: root `package.json` orchestrator that delegates per-package commands (`pnpm --dir` / `uv run --directory`) and runs dev tasks in parallel via a pinned `concurrently` devDependency, with a minimal root lockfile and without moving package lockfiles or introducing a workspace.
- `continuous-integration`: GitHub Actions pipelines gating the frontend (tsc/lint/build) and API (uv sync --frozen / pytest / lint-typecheck), triggered when a PR is marked ready for review.
- `automated-dependency-updates`: Dependabot policy (`.github/dependabot.yml`) that runs on a weekly schedule, groups minors/patches, isolates majors into separate PRs, bounds open PRs via `open-pull-requests-limit`, never automerges, and covers both pnpm projects, both uv projects, verified Docker references, and GitHub Actions. Added as the final, standalone PR.

### Modified Capabilities
<!-- openspec/specs/ is empty; there are no pre-existing capability specs to modify. -->

## Impact

- **Code / configs**: `monbo-api/{requirements.txt→pyproject.toml,uv.lock,.python-version,package.json,Dockerfile.dev,Dockerfile.prod}`, `scripts/update-gfw-tmf/{requirements.txt→pyproject.toml,uv.lock}`, root `pyproject.toml` (remove/consolidate duplicate mypy config), root `package.json` + `pnpm-lock.yaml`, `monbo-front/package.json`, `monbo-front/{next.config.ts,eslint.config.mjs,tsconfig.json,src/middleware.tsx,src/app/layout.tsx,src/app/[locale]/page.tsx,src/components/page/deforestationAnalysis/MapsDetailsModal.tsx}`, the usages of `TFunction` (8 files, verify with grep at implementation time: `src/components/page/deforestationAnalysis/DeforestationResultsTable.tsx`, `src/components/page/polygonsValidation/InconsistentFarmsTable.tsx`, `src/components/page/polygonsValidation/DownloadPageData.tsx`, `src/components/page/polygonsValidation/GeometryInconsistencyModal.tsx`, `src/components/page/polygonsValidation/OverlapInconsistencyModal.tsx`, `src/utils/deforestationReport.tsx`, `src/utils/deforestationReport/sections.tsx`, `src/utils/excel.ts`), both frontend Dockerfiles, new `.github/workflows/*` and (in the final PR) `.github/dependabot.yml`, and the READMEs.
- **Dependencies / runtimes**: Python 3.11 → 3.12, Node 20 → 22 LTS; numpy 1 → 2 (via rasterio 1.5); MUI 6 → 7; Next 15 → 16; TypeScript 5.7 → 6; eslint 9 → 10; i18next 24 → 26.
- **Systems**: after a temporary, documented report-only bootstrap, new CI must be made blocking and configured as required branch-protection checks before the change is accepted; the final PR adds Dependabot, which opens grouped, weekly update PRs (bounded by `open-pull-requests-limit`, no automerge) that must pass CI and review before merge. No production API contract or DB changes.
- **Risk hotspots**: numpy 2 numeric correctness in deforestation ratios/imagery (Python 3.12 PR), Next 16 + Turbopack/standalone/MUI SSR, and i18next 26 `TFunction` typing.
- **Out of scope (deferred)**: MUI 9, Turborepo, Python 3.13 / Node 24, and the `xlsx` 0.18.5 security debt — documented with entry conditions in `design.md`.
