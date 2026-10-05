## Context

The repository is a two-application monorepo orchestrated from the root (`monorepo-orchestration`, "option A"): a root `package.json` delegates with `pnpm --dir` and `uv run --directory`, and each package keeps its own lockfile. Top-level folders today:

```
monbo-api/      FastAPI app (uv) — includes app/maps (Git LFS rasters)
monbo-front/    Next.js app (pnpm)
scripts/        update-gfw-tmf/ (uv, offline tool)
azure/          deploy.sh, render_api_app.py, deploy.env.example, monbo-frontend-app.yml
docs/  openspec/  .github/  .claude/
```

The technical review (Frente 1) recommends `apps/` + `infra/` + `tools/`, without Turborepo and without a pnpm workspace until a second JS package exists. This is change 2 of 5 in the infra roadmap:

1. exclude-maps-from-api-image (done);
2. this change;
3. unified-ci;
4. terraform-infrastructure;
5. continuous-deployment.

Paths to the old folders appear in about 36 files and 230 places: config, CI, Dependabot, the deploy script, docs, agent skills, specs, and a few code comments and test paths.

## Goals / Non-Goals

**Goals:**

- `apps/api`, `apps/web` and `tools/update-gfw-tmf`, with full Git history (`git log --follow`) and LFS tracking intact.
- Local development, tests, CI, Dependabot and `azure/deploy.sh` work from the new paths with no behaviour change.
- A diff that is purely mechanical, so it is reviewable as "moves + path updates".

**Non-Goals:**

- `infra/`: created by the Terraform change, together with its content.
- Moving or rewriting `azure/`: the Terraform change retires it.
- CI triggers, path filters or workflow unification: change 3.
- pnpm workspace, catalogs, Turborepo, `packages/shared-config`, `.tool-versions`.
- Renaming packages, images, Container Apps or CI jobs.
- Rewriting archived OpenSpec changes or historical CHANGELOG entries.
- Removing the stale `azure/monbo-frontend-app.yml`. It is not used by `deploy.sh`, but the skills still list it in the `NEXT_PUBLIC_*` checklist, so it goes with the Terraform change, which replaces it.

## Decisions

### D1. `apps/api` and `apps/web`, not `apps/monbo-api`

Short folder names match the reference layout and the review's proposal, and the repository already says "monbo". The package, image and app names keep `monbo-api` and `monbo-front`. Those are identifiers other systems use (ACR repositories, Container App names, `deploy.env` defaults, Dependabot group names), while the folder is only a location.

- **Alternative: `apps/monbo-api`.** Fewer textual changes, but redundant and inconsistent with `apps/web`.

### D2. `azure/` stays until Terraform replaces it

`layer-storage-infrastructure` names `azure/deploy.sh` in six requirements, and the docs describe it at length. The Terraform change deletes `deploy.sh` and `render_api_app.py` and moves `seed`/`countries` to `tools/`. Moving `azure/` to `infra/azure/` now would make two consecutive rewrites of the same spec and docs, with no benefit in between. Inside `deploy.sh` only the paths into the apps change: `REPO_ROOT` stays the parent of `azure/`.

- **Alternative: move it now for a "complete" layout.** Rejected: churn now, deleted soon after.

### D3. `git mv` per top-level folder, then path updates, as separate commits

1. One commit with only the three `git mv`s plus `.gitattributes`. Git records pure renames, so `git log --follow` and blame keep working and reviewers can skip it.
2. One or more commits with the path updates.

LFS: moving a tracked file moves its pointer, and no object is re-uploaded. `.gitattributes` must be updated in the same commit as the move. Otherwise the `.tif` files at the new path would be matched by no LFS rule, and the next `git add` of a raster would commit a 300 MB blob. Verification: `git lfs ls-files` lists the same six OIDs, now under `apps/api/app/maps/layers/rasters/`.

### D4. CI keeps its job names and only changes paths

The required checks match the job names "Test and static checks" and "Type-check, lint, build". Only `working-directory`, `cache-dependency-path` and the `hashFiles` globs change. The cache keys change with the paths, so the first run on the new layout starts with a cold Next.js cache. That is expected and costs one slow build. Triggers stay exactly as they are; change 3 owns them.

### D5. Dependabot directories move in place

Each `directory:` is edited in place, keeping groups, schedules, ignores, cooldowns and labels. Dependabot keys its PRs by directory, so PRs open against the old directories get closed as "no longer applicable", and their updates reappear for the new ones on the next scheduled run. Before merging, the open Dependabot PRs are listed so nobody is surprised.

### D6. Specs: only requirements that name paths are modified

Package names are identifiers and stay valid ("The `monbo-front` package SHALL…"), so only requirements and scenarios that name filesystem paths change. `monorepo-orchestration` gains a "Repository layout" requirement, so the folder convention, and the rule that folder names don't drive deployed names, are part of the spec rather than implied by it.

### D7. Ignored local folders are the developers' job, documented

`git mv` moves tracked files only. In every existing checkout, `monbo-api/.venv`, `monbo-front/node_modules`, `.next` and local `.env*` files stay under the old folder names, which then contain only ignored files. The onboarding doc and the PR description say what to do: move the `.env` files, delete the old folders, and re-run `pnpm install` / `uv sync`. The CHANGELOG `Unreleased` section records the move.

## Risks / Trade-offs

- **[Risk] A missed path reference** in a script that CI doesn't exercise (`azure/deploy.sh`, docs, skills). → Mitigation:
  - after the updates, `grep -rn "monbo-api/\|monbo-front/\|scripts/update-gfw"` outside archives, lockfiles and the CHANGELOG history must only show package or image names;
  - `bash -n` and a dry run of `deploy.sh`'s path-dependent helpers;
  - `seed` from `apps/api`.
- **[Risk] In-flight branches conflict.** This includes other Conductor workspaces and the open PRs #9, #12 and #13. → Mitigation: rename detection handles most rebases. Merge this change when few branches are in flight, and announce it.
- **[Risk] LFS rule mismatch commits raster blobs.** → Mitigation: D3. `.gitattributes` goes in the move commit, `git lfs ls-files` is checked, and `git check-attr filter apps/api/app/maps/layers/rasters/gfw.tif` must say `lfs`.
- **[Risk] The regression test resolves the web template through `parents[3]`.** After the move, `parents[3]` is `apps/`. → Mitigation: change the joined path to `web/public/…` and run the regression suite.
- **[Trade-off] Cold caches.** The first CI run after merge rebuilds caches. Old Dependabot PRs are churned.

## Migration Plan

1. Branch from `origin/dev`. Commit the moves and `.gitattributes` (D3), then the path updates.
2. Verify locally:
   - `pnpm dev` at the root;
   - `pnpm test` and `pnpm lint`;
   - `pnpm --dir apps/web build`;
   - `Dockerfile.dev` and `Dockerfile.prod` builds from `apps/*`;
   - `uv run --directory apps/api python -m app.modules.layers.seed`;
   - `git lfs ls-files`.
3. Open the PR into `dev`. Both required checks must run and pass under their unchanged names.
4. After merge: announce the path change and the ignored-folders cleanup, and watch Dependabot's next run.
5. **Rollback:** revert the merge commit. The moves are pure renames, so the revert is clean as long as no later commit depends on the new paths.

## Open Questions

None.
