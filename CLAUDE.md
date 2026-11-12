# Monbo

Monbo helps producers, cooperatives and exporters show compliance with the EU Deforestation
Regulation (EUDR). It validates farm geometries (module 1), measures forest loss after the
baseline against satellite rasters (module 2), and builds a due-diligence report (module 3).
Results become audit evidence, so **a silently wrong deforestation ratio is worse than a crash**.
Read first: `docs/onboarding.md` (flow, setup, gotchas) and `docs/architecture.md` (Azure, layers, admin).

## System map

- `apps/api/`: FastAPI on Python 3.13, managed with uv. Shapely, rasterio, geopandas and pyproj.
- `apps/web/`: Next.js App Router, React, TypeScript, MUI and i18next, managed with pnpm.
- There is no workspace manager. Each app has its own lockfile, and the root `package.json` only
  orchestrates.
- `tools/update-gfw-tmf/` is an offline Google Earth Engine job that regenerates the rasters. It
  never runs at request time. `tools/layers-ops/` seeds and manages layers on the Azure share.
- `infra/` holds Terraform (`terraform/platform`, `terraform/apps`) and `deploy.sh`.
- Every merge into `dev` deploys the dev environment (`.github/workflows/deploy.yml`).
- `openspec/` holds specs (`specs/`) and change proposals (`changes/`). `docs/` holds the
  project docs.

Invariants that decide what counts as a bug:

- **No farm data is kept on the server, and there is no database.** The session state lives in
  the browser's `DataContext` (`apps/web/src/context/DataContext.tsx`), so a refresh drops the
  flow by design. The server writes only the layers (through the admin) and anonymous usage
  events: `modules/usage/` appends one JSON line per step under `USAGE_DIR`. An event carries a
  per-tab session ID, the country and counts, **never farm data, file names or IPs**. See
  `docs/maps.md`, "Usage events".
- **Per-farm and per-map failures are swallowed on purpose.** `value: null` (area `-1`) means
  "could not be computed". The sentinel must never reach arithmetic or a report as a real value.
- **`analize` is the contract spelling** (`POST /deforestation_analysis/analize`, `AnalizeBody`).
  "Fixing" it on one side only breaks the contract.
- **Rasters are Git LFS files** under `apps/api/app/maps/layers/rasters/`, catalogued in
  `apps/api/app/maps/index.json`. Without `git lfs pull`, module 2 fails.
- **The ratio** is `min(1.0, deforested_pixels × pixel_size² / geodesic_area)`, with
  `rasterio.mask.mask(..., all_touched=True)` and the area from
  `app/helpers/GeometryCalculator.py`. See `docs/deforestation_calculation.md` and
  `docs/polygon_area_calculation.md`.
- **The PDF report is built in the browser.** The API only produces images and tiles.
- **The admin (`/admin`) is opt-in.** It needs `ADMIN_SESSION_SECRET` and the per-country
  layout. Its routes reach only the session's country, except `GET /admin/usage`, which shows
  every country's usage to any admin by design. See `docs/architecture.md`.

## Commands

From the root: `pnpm dev` (both apps), `pnpm test`, `pnpm lint`, `pnpm build` (web), and
`pnpm contracts` (regenerates `apps/api/openapi.json` and `apps/web/src/api/schema.d.ts`).
Setup, including `.env` files and LFS, is in `docs/onboarding.md` §4.

CI runs these per app (`.github/workflows/ci.yml`):

- `apps/api`: `uv sync --frozen`, `uv run pytest`, `uv run ruff check .`,
  `uv run black --check .`, `uv run mypy app`, `uv run python -m app.openapi --check`.
- `apps/web`: `pnpm install --frozen-lockfile`, then:
  - the check that `src/api/schema.d.ts` matches `openapi.json`;
  - `pnpm exec tsc --noEmit`;
  - `pnpm run lint`;
  - `pnpm test`;
  - `pnpm run build`.
- `infra/terraform`: `terraform fmt -check -recursive`, then validate and test.

## Code conventions

### API (`apps/api/app/`)

- One package per module under `modules/<name>/`, exported from `modules/__init__.py` and
  registered in `main.py`.
- `router.py` stays thin: it validates, calls helpers and responds. Logic goes in `helpers.py`
  or a named file, module-local models in `models.py`, and domain checks in `validations.py`.
- Models shared across modules go in `app/models/`; cross-module utilities in `app/utils/`.
- **The Pydantic models are the contract.**
  - JSON fields are camelCase (`farmId`, `mapId`). The static JSON on disk (`index.json`)
    stays snake_case, and the route that serves it maps between the two
    (`modules/maps/router.py`).
  - Every JSON route declares `response_model`. The image and tile routes return PNGs.
  - A field the response always sends is required: set
    `json_schema_serialization_defaults_required` (`tests/test_openapi.py` checks it).
  - A shape that depends on a `type` is a discriminated union.
  - A contract change commits the model, `openapi.json` and `schema.d.ts` together. CI fails both
    jobs when either generated file is stale. See `apps/api/README.md`, "Changing a contract".
- Invalid user input becomes `HTTPException(status_code=400, ...)`, chained with `from exc`,
  never a 500.
- Environment variables are read and validated once in `app/config/env.py`. Fixed values go in
  `app/config/constants.py`. CLI entry points may read their own variables.
- New logging goes through `app/config/logger.py`. The remaining `print` calls are legacy, not a
  pattern to copy. Code must pass mypy, ruff and black (line length 88).
- Dependencies are pinned exactly in `pyproject.toml`, and `uv.lock` goes in the same commit.

### Web (`apps/web/src/`)

- Backend calls live in `api/*.ts`, with URLs from `config/env.ts`. Each endpoint has its own
  `NEXT_PUBLIC_*` variable that falls back to `${NEXT_PUBLIC_API_URL}/...`.
- Never write an API shape by hand. `src/api/schema.d.ts` is generated (don't edit it), and
  `interfaces/` re-exports its types under the names the code uses.
- **A new `NEXT_PUBLIC_*` variable that production sets at runtime needs four edits together:**
  - the `__NEXT_PUBLIC_X__` placeholder fallback in `config/env.ts`;
  - a line in `entrypoint.sh`;
  - an `env` block in `infra/terraform/apps/web.tf`;
  - the `.env.*.example` files.

  If one is missing it works in `next dev` and breaks in production. The per-endpoint
  `NEXT_PUBLIC_<X>_URL` overrides are build-time only and fall back to `NEXT_PUBLIC_API_URL`,
  so they need none of this.
- Product settings owned by the API (the overlap and deforestation thresholds) come from
  `GET /config` through `config/runtime.ts`. Never duplicate them as `NEXT_PUBLIC_*` variables.
- **All user-facing text goes through i18next**, with every key in both `locales/es/` and
  `locales/en/` (`es` is the default). The upload templates in `public/files/` exist per locale.
- Flow state belongs in `DataContext`. Components go in `components/page/<module>/` when
  screen-specific and in `components/reusable/` when generic. Hooks go one per file in `hooks/`.
- Component files are PascalCase (`MapComponent.tsx`), and hooks are camelCase with a `use`
  prefix. Styling is MUI (`sx` and the theme in `config/theme.ts`).

### Map layers

A new or changed layer touches these together:

- its entry in `app/maps/index.json`: a unique `id`, `pixel_size` in meters, `baseline`,
  `compared_against` and ISO 3166-1 alpha-2 `available_countries_codes`;
- the raster, as an LFS file;
- the attribute (`.json`) and consideration (`.md`) metadata in both
  `metadata/*/es/` and `metadata/*/en/`.

See `docs/maps.md`. A layer `id` is part of the contract with the web and appears in results:
never renumber or reuse one.

### Repo-wide

- Code, comments, commits, PR titles and bodies, and OpenSpec artifacts are written in English.
- The version lives in four files that must match: the root `package.json`,
  `apps/api/package.json`, `apps/web/package.json` and `apps/api/pyproject.toml`. A release adds
  a `CHANGELOG.md` entry.
- Runtime versions stay aligned across Dockerfiles, `engines`, `.python-version` and CI: Node 24
  and Python 3.13. The uv version (`0.11.21`) appears in both API Dockerfiles and in `ci.yml`.

## Security

- **Public routes have no authentication.** CORS is open, without credentials. Treat every
  public request body as hostile: path traversal from `map_id` or filenames, oversized uploads
  or polygons, URLs in documents. `POST /events` is public and has no rate limit: it accepts a
  closed list of events with a size cap, and its figures are labeled browser-reported because
  anyone can fake them.
- **`/admin` requires a per-country session token.**
  - Login is by passkey: only its SHA-256 hash is stored, compared in constant time, and failed
    logins are rate-limited.
  - The token is HMAC-signed with `ADMIN_SESSION_SECRET` (at least 32 bytes) and rechecked
    against `countries.json` on every call.
  - `ADMIN_ALLOWED_ORIGIN` restricts the admin's origin. A new admin route stays scoped to the
    token's country unless its spec says otherwise, as `GET /admin/usage` does.
  - Passkeys never go in `.env` or in the repo. See `docs/architecture.md` and `docs/maps.md`.
- **Secrets reach the app only through environment variables.**
  - These are secrets: `GCP_MAPS_PLATFORM_SIGNATURE_SECRET`, `ADMIN_SESSION_SECRET` and
    `AZURE_STORAGE_KEY`.
  - `NEXT_PUBLIC_*` values are public by design: never put a secret in one.
  - Real `.env` files are git-ignored. Only the templates and examples are committed.
- Large binaries go through Git LFS (`.gitattributes`). A raster committed as a normal blob
  bloats the repository for good.
- GitHub Actions are pinned to full commit SHAs with a `# vX.Y.Z` comment. Dependencies are
  pinned and their lockfiles are frozen in CI.

## Testing

- **API:** pytest under `apps/api/tests/`, where `modules/` mirrors `app/modules/`. Run one file
  with `uv run pytest <path>` from `apps/api`.
- **Regression suite:** `regression/` pins the results of the 10 farms in `regression_farms.xlsx`.
  Regenerate (`uv run python -m tests.regression.generate`) only for an intended change.
- **Numeric baseline:** `tests/test_numeric_baseline.py` guards the deforestation numbers against
  `tests/numeric_baseline/`. Changes to the math, masking, reprojection or area, and upgrades of
  numpy, rasterio, shapely, pyproj or geopandas must keep it green. **Regenerating the baseline
  to make CI pass is the bug.** If the numbers truly change, the PR explains why.
- **Web:** Vitest with Testing Library in jsdom. Tests sit next to the code as
  `src/**/*.test.ts(x)`, with shared helpers in `src/test/`. A test mocks `@/api/*`, never
  `fetch`. Run one file with `pnpm exec vitest run <path>` from `apps/web`. What is covered and
  how the setup resets state is in `apps/web/README.md`, "Testing".
- Translation parity (`src/locales/locales.test.ts`) fails on a key in only one locale. A bug
  fix comes with a regression test in the layer that broke.

## Workflow

- `dev` is the default branch, and every PR targets it. `main` changes only through a release
  or a hotfix. See `docs/branch_protection.md`.
- The required checks are the job names `Test and static checks` (API) and
  `Tests, type-check, lint, build` (web). Renaming either one follows the steps in
  `docs/branch_protection.md`. Draft PRs don't run CI.
- Changes are specified in `openspec/changes/<name>/` (proposal, design, specs, tasks) and
  archived into `openspec/specs/` when done. Don't edit `openspec/specs/` by hand.
- A change that alters something stated here, or in `docs/onboarding.md`, updates it in the same
  PR.

## Domain skills

| Skill | Use it when |
|---|---|
| `openspec-explore` (`/opsx:explore`) | Thinking through a problem or idea before writing a change |
| `openspec-propose` (`/opsx:propose`) | Creating a change with proposal, design, specs and tasks |
| `openspec-apply-change` (`/opsx:apply`) | Implementing a change's tasks |
| `openspec-archive-change` (`/opsx:archive`) | Archiving a finished change into `openspec/specs/` |
| `openspec-sync-specs` (`/opsx:sync`) | Syncing a change's delta specs into the main specs without archiving |
| `pr-review` (`/pr-review <n>`) | Reviewing a PR against these conventions and posting the findings on GitHub |
| `pr-comment-triage` | Acting on a PR's review comments as its author: triage, fix and reply |
