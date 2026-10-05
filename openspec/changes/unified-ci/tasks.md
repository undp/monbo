## 1. Workflow

- [x] 1.1 Create `.github/workflows/ci.yml` (`name: CI`):
  - `on.pull_request`: `types` `[opened, synchronize, ready_for_review]` and `branches` `[dev, main]`;
  - `permissions: {}` at the top;
  - `concurrency` with group `ci-${{ github.event.pull_request.number }}` and `cancel-in-progress: true`
- [x] 1.2 `changes` job:
  - `if: github.event.pull_request.draft == false`;
  - `permissions: pull-requests: read`;
  - one step that lists the PR files with `gh api --paginate repos/${{ github.repository }}/pulls/${{ github.event.pull_request.number }}/files --jq '.[].filename'` (`GH_TOKEN: ${{ github.token }}`), classifies them, and writes `api` and `web` to `$GITHUB_OUTPUT`:
    - `apps/api/` → api;
    - `apps/web/` → web;
    - `.github/workflows/ci.yml` → both;
    - 3,000 or more files → both (D3).
  Use `set -euo pipefail`, so a failed call fails the job instead of emitting false outputs. Log the decision
- [x] 1.3 `api` job:
  - name "Test and static checks";
  - `needs: changes`, and the `if` from D3: draft false, `!cancelled()`, and `needs.changes.result != 'success' || needs.changes.outputs.api == 'true'`;
  - `permissions: contents: read`;
  - steps copied verbatim from `api.yml`, with `working-directory: apps/api` and the same SHA pins and uv `version: "0.11.21"`
- [x] 1.4 `web` job:
  - name "Type-check, lint, build";
  - the same pattern with the `web` output;
  - `permissions: contents: read`;
  - steps copied verbatim from `frontend.yml` (pnpm, Node 24, both caches, install, tsc, lint, build) with `working-directory: apps/web`
- [x] 1.5 Delete `.github/workflows/api.yml` and `.github/workflows/frontend.yml`
- [x] 1.6 Lint the workflow. Use `actionlint` if it can be installed (`brew install actionlint` or `go run`); otherwise parse the YAML and review the expressions by hand
- [x] 1.7 Test the classification locally against real PRs, read-only. Run the same shell from step 1.2 against:
  - #9 (docs);
  - #48 (API dependencies);
  - #52 (web dependencies);
  - a PR that touched workflows, if there is one.
  Check the `api` and `web` outputs
  - Result:
    - `actionlint` 1.7.12, run via Docker with shellcheck 0.11 bundled: 0 errors.
    - The real API calls work. #9, #48, #52 and #14 all give `api=false web=false`, because their files are still under `monbo-api/` and `monbo-front/` (pre-move); see the design risk on old-path PRs.
    - With a stubbed `gh`, all 11 cases came out as expected:
      - docs-only → none;
      - `apps/api` → api;
      - `apps/web` → web;
      - both apps → both;
      - `ci.yml` → both;
      - a file renamed out of `apps/api` → api;
      - lookalike prefixes (`apps/api-docs`, `apps/webby`) → none;
      - `dependabot.yml` → none;
      - an empty PR → none;
      - 3,000 files → both;
      - an API failure → the job fails, so the package jobs run (fail-open).

## 2. Docs and skills

- [x] 2.1 `docs/branch_protection.md`:
  - the checks table: workflow `CI`, file `.github/workflows/ci.yml`, same job names;
  - rewrite "Draft pull requests never report" to match job-level skipping and the result of 3.2;
  - add a short "Which checks run" section: change detection, skipped = passed, fail-open, and only PRs into `dev`/`main`
- [x] 2.2 Root `README.md`: the CI bullet (one workflow, change detection, PRs into `dev`/`main`), and the uv version location `.github/workflows/ci.yml`
- [x] 2.3 `apps/api/README.md` and `apps/web/README.md`: the "Continuous Integration" sections name the `CI` workflow and its job, and when it runs. Update the uv version location in the API README
- [x] 2.4 `.claude/skills/pr-review/SKILL.md`: "API CI" and "Frontend CI" become the jobs of the CI workflow, and the uv location is `.github/workflows/ci.yml`. Note that skipped checks on a PR mean "not affected", not "not run by mistake"
- [x] 2.5 Run `grep -rn "api.yml\|frontend.yml\|API CI\|Frontend CI"` outside archives. Only historical mentions may remain

## 3. Verification on GitHub (needs pushing; ask before each push or PR)

- [x] 3.1 The PR that carries this change (into `dev`) changes `ci.yml`, so both jobs run and both required checks report under their names
  - Result (#54, run 37348214446): `Detect changes` listed 760 files (renames counted at both paths) and gave `api=true web=true`. Both required checks passed under their names, and the PR is `MERGEABLE` / `CLEAN`.
- [ ] 3.2 Throwaway PRs into `dev`, closed without merging, then their branches deleted:
  - docs-only: both checks skipped, and GitHub shows the PR as mergeable;
  - API-only: only "Test and static checks" runs;
  - web-only: only "Type-check, lint, build" runs.
  Record the results in this file
- [ ] 3.3 Pushing twice quickly to the same PR cancels the first run
  - Pushed two commits about 10 s apart on #54 (this note is the second one).
- [ ] 3.4 A PR into `main` runs CI. Use the next release PR, or a throwaway PR into `main` that is closed
- [x] 3.5 Run `openspec validate unified-ci`
