## 1. Baseline

- [x] 1.1 Work on the same branch as exclude-maps-from-api-image (stacked on it). Record in `.context/` a baseline to compare against after the move:
  - `git lfs ls-files -l` (the six OIDs);
  - `git ls-files | wc -l`;
  - the list of open PRs from `gh pr list` (Dependabot ones included, see D5)
- [x] 1.2 Record every reference to the old paths: `grep -rIn -e "monbo-api" -e "monbo-front" -e "scripts/" -e "update-gfw"` excluding `node_modules`, `.venv`, `.next`, lockfiles and `openspec/changes/archive`. Use it as the checklist for section 3

## 2. Moves (one commit, renames only — D3)

- [x] 2.1 `git mv monbo-api apps/api`, `git mv monbo-front apps/web`, `git mv scripts/update-gfw-tmf tools/update-gfw-tmf`. Make sure `scripts/` is gone
- [x] 2.2 In the same commit, update `.gitattributes` to `apps/api/app/maps/layers/rasters/*.tif filter=lfs diff=lfs merge=lfs -text`
- [x] 2.3 Verify before committing:
  - `git lfs ls-files` lists the same six OIDs under `apps/api/…`;
  - `git check-attr filter apps/api/app/maps/layers/rasters/gfw.tif` says `lfs`;
  - `git status` shows only renames plus `.gitattributes`
- [x] 2.4 Move this workspace's ignored folders so local verification works: `.venv`, `node_modules`, `.next`, `.env*`. Delete the empty old folders. Commit the moves (`refactor: move apps under apps/ and the GFW/TMF script under tools/`)

## 3. Path updates

- [x] 3.1 Root `package.json`: the `dev`, `test`, `lint` and `build` scripts use `apps/web` and `apps/api`. Update the `description` if it names folders
- [x] 3.2 `.github/workflows/api.yml`: `working-directory: apps/api`. `.github/workflows/frontend.yml`: `working-directory`, `cache-dependency-path`, the `.next/cache` path and both `hashFiles` globs. Job names, triggers and steps stay unchanged (D4)
- [x] 3.3 `.github/dependabot.yml`: the seven `directory:` values (`/apps/web` npm and docker, `/apps/api` uv and docker, `/tools/update-gfw-tmf` uv), plus their comments. Check that every `directory` exists
- [x] 3.4 `azure/deploy.sh`:
  - `check_rasters_are_real`;
  - the `build_and_push` contexts and Dockerfiles;
  - the `seed_share` and `countries` `uv run --directory` paths;
  - the comments.
  Image and app names don't change. Run `bash -n`, and check the paths it builds against the tree
- [x] 3.5 Code comments and test paths:
  - `apps/api/tests/regression/test_regression.py`: `TEMPLATE_PATH` is now `parents[3] / "web/public/files/…"`; check what `parents[3]` resolves to;
  - `tests/regression/pipeline.py`, `tests/numeric_baseline/generate_baseline.py` and `app/modules/admin/models.py`;
  - `apps/web/src/interfaces/AdminLayer.ts` and `scripts/generate-country-shapes.mjs` ("from apps/web/")
- [x] 3.6 Root `README.md`:
  - the project structure (`apps/web`, `apps/api`) and the links to app READMEs;
  - the orchestrator section;
  - the Node note;
  - the Dependabot directory and deferral tables;
  - the uv binary locations
- [x] 3.7 `apps/api/README.md`, `apps/web/README.md` and `tools/update-gfw-tmf/README.md`: the `cd` commands, paths and links. Absolute `/docs/...` image links keep working
- [x] 3.8 `docs/onboarding.md`, `docs/architecture.md`, `docs/suggested_deployment.md` and `docs/maps.md`: every path. In onboarding, add a short note on cleaning up the old ignored folders after pulling (D7)
- [x] 3.9 `CHANGELOG.md`: an `Unreleased` → `Changed` entry for the move. Don't edit historical entries
- [x] 3.10 `.claude/skills/pr-review/SKILL.md` and `.claude/skills/pr-comment-triage/SKILL.md`: the paths (`apps/web/src/interfaces/`…). Leave the `azure/monbo-frontend-app.yml` mention as is
- [x] 3.11 Re-run the grep from 1.2. The only hits left should be package, image or app names (`monbo-api`, `monbo-front`), CHANGELOG history, archived changes and lockfiles

## 4. Specs

- [x] 4.1 Check that no other live spec under `openspec/specs/` names an old path (`grep -rn "monbo-api/\|monbo-front/\|scripts/update" openspec/specs`), beyond the five capabilities in this change. Run `openspec validate monorepo-layout`

## 5. Verification

- [x] 5.1 API: `pnpm test` and `pnpm lint` at the root. Run `uv run --directory apps/api pytest`, the regression suite included, and the static checks
- [x] 5.2 Frontend: `pnpm --dir apps/web install --frozen-lockfile`, `exec tsc --noEmit`, `lint` and `build`
- [x] 5.3 Root `pnpm dev`: both servers start, the API serves `app/maps` from `apps/api`, and the web app loads
- [x] 5.4 Docker: build `apps/api/Dockerfile.prod` and `apps/web/Dockerfile.prod` with their folders as context, and check that `apps/api/Dockerfile.dev` runs with the bind mount
- [x] 5.5 Seed from the new path: `uv run --directory apps/api python -m app.modules.layers.seed --target /tmp/maps-seed`
- [x] 5.6 `tools/update-gfw-tmf`: `uv lock --check` (or `uv sync --frozen --dry-run`) resolves from the new folder
- [x] 5.7 `git log --follow --oneline apps/api/app/main.py | tail -3` shows commits from before the move

## 6. PR

- [ ] 6.1 Open the PR into `dev` with:
  - the move and path commits;
  - a note to review by commit;
  - the developer cleanup steps (D7);
  - the expected Dependabot churn (D5).
  Both required checks must run and pass under their unchanged names
- [ ] 6.2 After merge: announce the new paths to the team, and check Dependabot's next run opens PRs against the new directories
