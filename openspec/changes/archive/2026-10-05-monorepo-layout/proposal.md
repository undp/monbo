## Why

The repository root mixes deployable applications (`monbo-api/`, `monbo-front/`) with what supports them: `azure/`, `scripts/`, `docs/`, `openspec/`. The next changes of the infra roadmap add more of that support: unified CI, Terraform under `infra/`, and operational tools under `tools/`. Settling the layout now, while nothing large is in flight, means those changes land in their final place instead of being moved again later.

The technical review (Frente 1) recommends keeping the language-independent conventions of the reference monorepo, `apps/` for what is deployed and `tools/` for operational scripts, without its TypeScript-only build machinery. Monbo's API is Python, so a pnpm workspace or Turborepo would add ceremony with nothing to share or cache.

## What Changes

- **Move the applications under `apps/`**, with `git mv` so history and Git LFS pointers follow:
  - `monbo-api/` → `apps/api/`;
  - `monbo-front/` → `apps/web/`.
- **Move the offline GFW/TMF script under `tools/`**: `scripts/update-gfw-tmf/` → `tools/update-gfw-tmf/`. `scripts/` disappears.
- **Keep `azure/` where it is.** The Terraform change replaces `deploy.sh` and `render_api_app.py` with `infra/terraform/`, and moves `seed` and `countries` to `tools/`. Moving `azure/` now would rewrite those files, their docs and the `layer-storage-infrastructure` spec twice. `infra/` is created by the change that gives it content.
- **Update every reference to the old paths:**
  - `.gitattributes` (the LFS pattern for the rasters);
  - the root `package.json` orchestrator scripts;
  - both CI workflows (`working-directory`, cache paths, `hashFiles`), keeping their job names, which are the required checks;
  - the seven `directory:` entries of `.github/dependabot.yml`;
  - `azure/deploy.sh` (build contexts, `seed` and `countries` paths);
  - the root, app and tool READMEs, `docs/`, and an `Unreleased` CHANGELOG entry;
  - code comments and test paths;
  - the repository's agent skills;
  - the live OpenSpec specs.
  Archived changes are history and are not rewritten.
- **Names don't change:**
  - the package names (`monbo-api` in `pyproject.toml` and `package.json`, `monbo-front` in `package.json`);
  - the Docker image names in ACR;
  - the Container App names;
  - the CI job names.
  Deployment and branch protection are unaffected.
- **No workspace tooling.** Still no `pnpm-workspace.yaml` and no Turborepo; each package keeps its own lockfile.
- **BREAKING (developers):**
  - local paths change (`cd monbo-api` → `cd apps/api`);
  - ignored folders (`.venv`, `node_modules`, `.next`, `.env*`) stay behind in the old folders after pulling, and must be recreated or moved;
  - open branches need a rebase, which Git's rename detection handles in most cases.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `monorepo-orchestration`:
  - adds the repository layout (`apps/api`, `apps/web`, `tools/`), and keeps package and image names independent of folder names;
  - the lockfile requirement now names the new paths.
- `frontend-dependency-toolchain`: the manifest scenario points at `apps/web/package.json`.
- `python-dependency-toolchain`:
  - the clean-checkout scenario uses `apps/api`;
  - the GFW/TMF script requirement points at `tools/update-gfw-tmf`.
- `automated-dependency-updates`: Dependabot coverage is stated against the new directories.
- `layer-storage-infrastructure`: the "clone keeps the layers" scenario points at `apps/api/app/maps/`.

## Impact

- **Moves:** `monbo-api/`, `monbo-front/` and `scripts/update-gfw-tmf/`, with every tracked file, including about 511 MB of LFS rasters. Only pointers move; no LFS objects are re-uploaded.
- **Config:**
  - `.gitattributes`;
  - root `package.json`;
  - `.github/workflows/api.yml` and `frontend.yml`;
  - `.github/dependabot.yml`.
- **Scripts:** `azure/deploy.sh`.
- **Code (comments and paths only):**
  - `apps/api/tests/regression/test_regression.py` (path to the web template);
  - `apps/api/tests/regression/pipeline.py`, `apps/api/tests/numeric_baseline/generate_baseline.py` and `apps/api/app/modules/admin/models.py`;
  - `apps/web/src/interfaces/AdminLayer.ts` and `apps/web/scripts/generate-country-shapes.mjs`.
- **Docs:**
  - root `README.md`;
  - `apps/api/README.md`, `apps/web/README.md` and `tools/update-gfw-tmf/README.md`;
  - `docs/onboarding.md`, `docs/architecture.md`, `docs/suggested_deployment.md` and `docs/maps.md`;
  - `CHANGELOG.md`.
- **Agent skills:** `.claude/skills/pr-review/SKILL.md` and `.claude/skills/pr-comment-triage/SKILL.md`.
- **Specs:** the five capabilities above.
- **Dependabot:** entries for new directories start fresh. Open Dependabot PRs for the old directories are closed and reopened against the new ones on the next run.
- **Unaffected:**
  - application behaviour;
  - API routes;
  - Docker build contexts, which stay per app;
  - required checks and rulesets;
  - Azure resources;
  - the share.
