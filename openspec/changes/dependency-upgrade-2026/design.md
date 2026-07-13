## Context

Monbo is a monorepo with three dependency surfaces:

- **`monbo-front`** — Next.js 15.3.1, React 19.1, TypeScript 5.7, MUI 6, managed with pnpm.
- **`monbo-api`** — FastAPI 0.115.6 on Python 3.11, dependencies pinned in `requirements.txt` (pip), heavy geospatial stack (shapely / geopandas / rasterio / pyproj). Tested with pytest.
- **`scripts/update-gfw-tmf`** — earthengine-api, geemap, GDAL, `tenacity<9`.

Docker uses `python:3.11-slim` and `node:20-alpine` (Node 20 has been EOL since 2026-04-30). There is no CI, no dependency bot; the frontend has no tests, the API has pytest. This change modernizes runtimes and dependencies and adds CI plus — as a final, standalone step — a dependency bot (Dependabot) for guardrails. The plan and all version targets below are the approved input and are transcribed faithfully — this design sequences and de-risks them, it does not re-open the decisions.

## Goals / Non-Goals

**Goals:**
- Migrate Python packaging to uv (pyproject + `uv.lock` + dependency-groups); keep pnpm for the frontend.
- Raise runtimes: API to Python 3.12 (unlocking rasterio 1.5 + numpy 2), frontend to Node 22 LTS.
- Bring both dependency tracks current, up to and including MUI 7, Next 16, TypeScript 6, eslint 10, i18next 26.
- Add a root `package.json` orchestrator (option A), minimal CI, and — as a final, standalone step — a dependency bot (Dependabot).
- Ship the work as 11 reviewable PRs across two independent tracks (only PR 1 is a shared prerequisite), with PR 11 as the final standalone dependency-bot change.

**Non-Goals (deferred — see "Deferred / Out-of-scope"):**
- MUI 9, Turborepo, Python 3.13, Node 24, and the `xlsx` 0.18.5 security remediation.
- Any product/feature change, API contract change, or DB change.
- Adding frontend unit tests (out of scope for this upgrade).

## Decisions

### D1 — uv for Python, pnpm retained for frontend
Migrate `monbo-api` and `scripts/update-gfw-tmf` to uv: `pyproject.toml` with production deps + a `dev` dependency-group (pytest, pytest-cov, ruff, black, mypy), a committed `uv.lock`, and `.python-version`. Remove `requirements.txt` and collapse the duplicated `fastapi` + `fastapi[standard]` entry. pytest config (`testpaths`) moves into `pyproject.toml`.
*Alternative considered:* Poetry / pip-tools — rejected; uv is faster, has a first-class lockfile and dependency-groups, and integrates cleanly with Docker via `uv sync --frozen`.

### D2 — Root orchestrator "option A" (no workspace, no Turbo)
Root `package.json` with `dev` / `test` / `lint` / `build` scripts delegating via `pnpm --dir <pkg>` and `uv run --directory <pkg>`, using `pnpm exec concurrently` for parallel dev. `concurrently` is a pinned root devDependency, so the root is a minimal pnpm project with its own committed `pnpm-lock.yaml`; the frontend and Python package lockfiles remain in their package directories. This is still not a pnpm workspace.
*Alternatives considered:* `pnpm dlx concurrently` was rejected because it downloads an unpinned tool on every clean run. A pnpm workspace (which would centralize JS dependency resolution and touch Dockerfiles/Dependabot config) and Turborepo are both premature with a single JS application. Entry condition for revisiting is documented below.

### D3 — Python 3.12 + rasterio 1.5 + numpy 2 together
rasterio 1.5 requires Python >=3.12 and numpy >=2 (verified on PyPI), so the interpreter bump and rasterio bump are coupled in PR 4. However, the uv lock generated in PR 1 already resolves numpy 2.4.6 under rasterio 1.4.3; numpy 2 is therefore introduced by the lockfile migration, not first by PR 4. Before PR 1 can be accepted, the inherited pytest failures must be repaired and an automated, version-controlled numeric fixture/baseline captured from the pre-upgrade numpy 1 environment must pass under the PR 1 lock. PR 4 is a second hard gate that reruns the same comparison after Python 3.12/rasterio 1.5. mypy `python_version` moves 3.10 → 3.12 in the authoritative `monbo-api/pyproject.toml`; the duplicate root mypy block is removed or consolidated so it cannot drift. Docker base → `python:3.12-slim`.

### D4 — Node 22 LTS + Next 16 coupled
Next 16 itself only requires Node >= 20.9; Node 22 LTS is the project's approved baseline (a decision, not a Next requirement). `next lint` is removed in Next 16, so the lint script becomes `eslint .`; `--turbo` is dropped from dev (Turbopack is the default) with `next build --webpack` as fallback. eslint 10 requires Node 20.19 / 22.13 / 24+, so it must land on the Node 22 runtime. Docker base → `node:22-alpine`.

### D5 — MUI only to v7 now; v8 does not exist
Published MUI majors are 5, 6, 7, 9 — there is no v8. Upgrade 6 → 7 via the official codemod (`Grid2` → `Grid`, `@mui/material-nextjs/v15-appRouter` → `v16`). v9 is deferred until a visual-regression harness exists (D-defer).

### D6 — Coupled version bumps in a single commit
React + `@types/react`(-dom) bump together; i18next 26 + react-i18next 17 bump together (react-i18next 17 peers `i18next >= 26.2`). `@types/node` is aligned to the real Node 22 runtime (NOT bumped to 26).

### D7 — CI triggers on ready-for-review
Workflows fire on `types: [opened, synchronize, ready_for_review]` with `if: github.event.pull_request.draft == false`, so draft PRs don't burn CI minutes. Frontend job caches the pnpm store + `.next/cache`; API job runs `uv sync --frozen` + `uv run pytest` + ruff/black/mypy. The API workflow is temporarily report-only while inherited pytest, formatting, lint, and typing failures are repaired. That staging state is not the acceptance state: once the suite and static checks are green, every `continue-on-error` is removed and repository branch protection is verified to require both API and frontend jobs before merge.

### D8 — Dependency bot: Dependabot, added last
The automated dependency bot is **Dependabot** (`.github/dependabot.yml`), added as the **final, standalone PR** (PR 11) and decoupled from PR 1 — it is the lowest-priority guardrail and nothing depends on it. Policy: weekly schedule; group minors/patches to keep PR volume down; isolate each major into its own PR for review in isolation; bound the open-PR queue with `open-pull-requests-limit`; never automerge (every PR must pass CI + human review before merge). Coverage requires one `updates` entry per ecosystem/directory: `npm` (root orchestrator and `monbo-front`), `uv` (`monbo-api` and `scripts/update-gfw-tmf`), `docker` (each Dockerfile directory, with detection of `Dockerfile.dev`/`Dockerfile.prod` proven rather than assumed), and `github-actions`. PR 11 also decides whether the `ghcr.io/astral-sh/uv` `COPY --from` reference is in scope and records whether third-party Actions use full-SHA or major-tag pinning.

*Why Dependabot over Renovate:* Renovate is technically stronger for this stack (updates `pyproject.toml` + `uv.lock` together, granular grouping, a Dependency Dashboard, shared presets), but it requires installing the third-party Mend GitHub App (org-wide write access) or self-hosting. Dependabot is native to GitHub, needs zero extra infrastructure or third-party app, and its 2025-2026 improvements (multi-ecosystem / multi-directory grouping, uv support) close most of the gap for a repo this size. *Known caveat to verify at implementation time:* Dependabot has had uv bugs — `pyproject.toml`↔`uv.lock` desync (dependabot-core #12788) and running security updates via pip instead of uv (#13426); since `monbo-api` pins with `==`, confirm these are resolved or acceptable before relying on it.

### PR breakdown (the 11 PRs)

Two independent tracks; **PR 1 precedes everything**. Track Python = PRs 1–5. Track Front uses PRs 6–10, but merge order is PR 6 → PR 8 (Node 22/Next 16) → PR 7 (TypeScript 6/eslint 10) → PR 9 → PR 10 so eslint 10 never lands before Node 22; PR 7 still precedes PR 9.

| PR | Title | Scope (faithful to plan) | Risk / Effort |
|----|-------|--------------------------|---------------|
| 1 | Hygiene + uv + orchestration + CI | uv migration of `monbo-api` (pyproject prod deps + `dev` group pytest/pytest-cov/ruff/black/mypy, `uv.lock`, `.python-version=3.11`, drop `requirements.txt` + duplicate fastapi); API Dockerfiles `uv sync --frozen` (`--no-dev` prod); uv-migrate `scripts/update-gfw-tmf`; root `package.json` (dev/test/lint/build + pinned `concurrently` devDependency + root lockfile); `monbo-api/package.json` wrappers → uv; pytest `testpaths` in pyproject; repair inherited pytest/static-check failures; capture and automate the numpy 1 numeric baseline and validate it against the PR 1 lock (which already resolves numpy 2.4.6); `packageManager` in `monbo-front/package.json` (the `engines` field lands in PR 8 with the Docker bump); GitHub Actions CI (front: blocking Node 22 + tsc --noEmit + lint + build; API: initially report-only, then blocking uv sync + pytest + ruff/black/mypy); verify required branch-protection checks; README updates | Medium / L |
| 2 | API minors | shapely 2.1.2, geopandas 1.1.4, pyproj 3.7.2, uvicorn 0.51, colorlog 6.10, python-dotenv 1.2 (rasterio stays 1.4.3 until PR 4) | Low / S |
| 3 | API majors (nominal) | pillow 12, pytest 9 + pytest-cov 7, pycountry 26, fastapi 0.139 (Pydantic already v2, no `on_event`) | Low / M |
| 4 | Python 3.12 + rasterio 1.5 | `.python-version`/`requires-python` floor → 3.12, `python:3.12-slim` Dockerfiles, rasterio 1.5, re-run the numpy 2 numeric gate, update authoritative API mypy config 3.10 → 3.12 and remove/consolidate the duplicate root block, README | Medium / M |
| 5 | Script GFW/TMF | drop `tenacity<9` cap, bump earthengine-api/geemap | Low / S |
| 6 | Front minors | react/react-dom 19.2 (+ `@types/react`(-dom) same commit), @react-pdf/renderer 4.5, @vis.gl/react-google-maps 1.9, date-fns 4.4, fuse.js 7.4, lodash 4.18 (+ `@types/lodash`), @googlemaps/markerclusterer 2.6, @fontsource/roboto, @emotion/styled, next-i18n-router 5.5.8, @eslint/eslintrc | Low / S |
| 7 | Front toolchain (lands after PR 8) | TypeScript 6.0, eslint 10 on the established Node 22 runtime, `@types/node` 22.x aligned to runtime (NOT 26) | Medium / M |
| 8 | Next 16 + Node 22 | next 16.2.10 + eslint-config-next 16; `node:22-alpine` both Dockerfiles; use Corepack with the pinned `packageManager` and `pnpm install --frozen-lockfile` in Dockerfile.dev/prod; add `engines` (Node >=22) to `monbo-front/package.json`; lint `next lint` → `eslint .`; drop `--turbo` (Turbopack default; fallback `next build --webpack`); evaluate middleware→proxy codemod; manually verify standalone output (`postbuild` + `start:standalone`) and MUI SSR outside CI. Pages already use `await params/searchParams` (verified) | Medium-high / M |
| 9 | i18n majors | i18next 26.3 + react-i18next 17 together (peer i18next >= 26.2); main risk = the usages of `TFunction` (8 files, verify with grep at implementation time: `src/components/page/deforestationAnalysis/DeforestationResultsTable.tsx`, `src/components/page/polygonsValidation/InconsistentFarmsTable.tsx`, `src/components/page/polygonsValidation/DownloadPageData.tsx`, `src/components/page/polygonsValidation/GeometryInconsistencyModal.tsx`, `src/components/page/polygonsValidation/OverlapInconsistencyModal.tsx`, `src/utils/deforestationReport.tsx`, `src/utils/deforestationReport/sections.tsx`, `src/utils/excel.ts`); after PR 7; exhaustive es↔en smoke | Medium / M |
| 10 | Front small majors + MUI 7 | react-dropzone 15 (no `isDragReject`), p-limit 7 (only `pLimit(20)`), MUI 6 → 7 (official codemod, `Grid2` → `Grid` in `src/app/[locale]/page.tsx` + `src/components/page/deforestationAnalysis/MapsDetailsModal.tsx`, `@mui/material-nextjs/v15-appRouter` → `v16` in `src/app/layout.tsx`), visual review checklist | Medium / M |
| 11 | Dependency bot (Dependabot) | `.github/dependabot.yml`: weekly schedule; group minors/patches; isolate majors; `open-pull-requests-limit`; no automerge; entries for `npm` (root and `monbo-front`), `uv` (`monbo-api`, `scripts/update-gfw-tmf`), `docker` (verify all non-standard Dockerfile names and decide uv `COPY --from` scope), `github-actions` (evaluate SHA pinning). Standalone, final, independent of all other PRs | Low / S |

Note: PR 1 pins `.python-version=3.11`; PR 4 raises it to 3.12. The interpreter/rasterio bump remains isolated, but PR 1 is not numerically neutral because its `uv.lock` already selects numpy 2.4.6; that is why the numeric gate is required in both PR 1 and PR 4. PR 11 (Dependabot) is standalone and can land at any time, but is sequenced last as the lowest-priority guardrail.

## Risks / Trade-offs

- **R1 — numpy 2 changes deforestation numbers (PRs 1 and 4).** → Repair pytest first; capture a deterministic, version-controlled reference from the pre-upgrade numpy 1 environment; run the automated ratio/decoded-imagery comparison under PR 1's numpy 2.4.6 lock and again under PR 4. Block either PR unless the concrete tolerances in the Python capability spec and the full pytest suite pass on Linux x86_64 CI. This is the single most critical validation gate.
- **R2 — Next 16: Turbopack default / standalone output / MUI SSR (PR 8).** → CI covers frozen install + type-check + lint + build. Separately, PR 8 requires a documented manual verification of `output: "standalone"` via `postbuild` + `start:standalone` and MUI SSR; it is deliberately not represented as a CI step. Keep `next build --webpack` as fallback and evaluate the middleware→proxy codemod for `src/middleware.tsx`.
- **R3 — i18next 26 `TFunction` typing (PR 9).** → Land after PR 7 (TS 6) so the type toolchain is settled; fix the usages of `TFunction` (8 files, verify with grep at implementation time); exhaustive es↔en smoke of all flows.
- **R4 — MUI 7 visual regressions (PR 10).** → Run the official codemod, migrate `Grid2` → `Grid` and the App Router import path, and complete a manual visual review checklist (no automated visual regression yet — that gates MUI 9).
- **R5 — No frontend automated tests.** → CI relies on `tsc --noEmit` + lint + build + manual smoke of 4 flows in es and en; accepted for this upgrade.
- **R6 — Version drift between coupled packages.** → Enforce single-commit coupling for React/@types and i18next/react-i18next (D6); CI `--frozen` installs catch lockfile drift.
- **R7 — Peer/engine floor violations.** → eslint 10 needs Node >= 20.19/22.13/24+; Next 16 itself only needs Node >= 20.9 (Node 22 LTS is the project's approved baseline, not a Next requirement). PR 8 establishes Node 22 in `engines`, Docker, CI, and `@types/node`; PR 7 is not allowed to land until PR 8 has landed, so eslint 10 is always installed and validated on the declared runtime.

## Migration Plan

1. **PR 1 first** (shared prerequisite): establishes uv, the root orchestrator, and CI. CI may be introduced in report-only mode solely to expose inherited failures. Before PR 1 is accepted, repair pytest/static checks, capture the approved numpy 1 fixture/baseline, pass it and the suite under the PR 1 lock (numpy 2.4.6), remove every `continue-on-error`, and verify API/frontend jobs are required by branch protection. Local/Docker runtimes stay on Python 3.11/Node 20; frontend CI already uses Node 22 and `packageManager` is set. Nothing else merges before PR 1.
2. **Run the two tracks in parallel** after PR 1:
   - Python track: PR 2 → 3 → 4 → 5 (PR 4 repeats the runtime/numeric gate first enforced in PR 1).
   - Front track: PR 6 → PR 8 → PR 7 → PR 9 → PR 10. PR 8 establishes Node 22 before eslint 10 in PR 7; PR 9 requires PR 7.
   - Dependency bot: PR 11 (Dependabot) lands **last**, after both tracks — it is standalone and depends on nothing, so it is sequenced last as the lowest-priority guardrail.
3. **Per-PR validation** (see below) must pass in CI before merge; risky PRs (4, 8, 9, 10) additionally require the documented manual smoke.
4. **Rollback**: each PR is independently revertible. Because runtime bumps (PR 4 Python 3.12, PR 8 Node 22) are isolated in their own PRs, a runtime regression can be rolled back without reverting the dependency-currency PRs. CI (PR 1) and Dependabot (PR 11) are additive and safe to keep.

### Validation
- **API:** blocking CI runs `uv sync --frozen` + `uv run pytest` + ruff/black/mypy. The pytest suite includes the deterministic numpy baseline comparison; smoke `/health` + a deforestation analysis. The numeric gate runs before accepting PR 1 and again in PR 4.
- **Front:** CI runs `install --frozen-lockfile` + `tsc --noEmit` + lint + build. PR 8 separately records a manual `postbuild` + `start:standalone`/MUI SSR result. Manual smoke covers 4 flows in **es and en**: (1) home / country selection, (2) polygon validation with upload + Excel/GeoJSON downloads, (3) deforestation analysis with map/clusters/modals, (4) PDF report.

## Deferred / Out-of-scope (with entry conditions)

- **MUI 9** — deferred until a visual-regression harness exists. Entry condition: automated visual regression in place; then handle `PaperProps` → `slotProps` and the focus/click behavior changes in `ButtonBase` / `Menu` / `Tabs`.
- **Turborepo** — deferred. Entry condition: a *second* JS package appears → first introduce `pnpm-workspace` (centralizes JS package resolution; the existing minimal root orchestrator lockfile would be regenerated as the workspace lock and Dockerfiles + Dependabot config would change), and adopt Turbo only if build orchestration actually hurts.
- **Python 3.13 / Node 24** — deferred; stay on the current LTS/stable baselines (3.12 / 22) this cycle.
- **`xlsx` 0.18.5** — separate security debt; evaluate the official SheetJS distribution or consolidating on `exceljs`. Tracked independently of this upgrade.

## Open Questions

- Middleware → proxy codemod for `src/middleware.tsx` (PR 8): apply the codemod or keep the middleware as-is if it still works under Next 16 — decide during PR 8 based on codemod output.
- Exact `@types/node` 22.x patch line to pin against the chosen `node:22-alpine` image (PR 7/8).
