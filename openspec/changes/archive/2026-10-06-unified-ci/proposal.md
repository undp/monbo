## Why

CI runs everything on every pull request, whatever it changes and whatever it targets:

- `.github/workflows/api.yml` (API CI) and `frontend.yml` (Frontend CI) have no path or branch filter;
- a README-only PR runs pytest and a full Next.js build;
- a PR stacked onto a feature branch runs both too.

That costs minutes, and it makes a frontend-only PR wait on the API suite. It also means the build's network flakiness (Google Fonts, task 12.7 of the dependency upgrade) can block changes that never touch the frontend.

Filtering naively breaks branch protection:

- **A path filter on the workflow:** a workflow skipped by `paths:` never reports, so its required check waits forever.
- **A trigger only for PRs into `dev`:** release and hotfix PRs into `main`, whose ruleset requires the same checks, could never merge.

The monorepo layout (`apps/api`, `apps/web`) now makes "what changed" a clean prefix test, so this is the moment to do it properly.

## What Changes

- **One workflow, `.github/workflows/ci.yml` ("CI"),** replaces `api.yml` and `frontend.yml`. The two jobs keep their exact names, "Test and static checks" and "Type-check, lint, build", which are the required checks. The rulesets don't change.
- **A `changes` job decides what runs.** It reads the pull request's files from the GitHub API, using the built-in token with read-only permissions and no third-party action, and outputs `api` and `web`:
  - `apps/api/**` → API;
  - `apps/web/**` → web;
  - a change to `ci.yml` itself → both.
  The package jobs use job-level `if:`. A job skipped by a condition reports success, so a docs-only PR stays mergeable without running anything heavy.
- **Detection fails open.** If `changes` fails or can't be trusted (for example the API's file-list cap), both jobs run. A detection error can never skip tests, because a skipped required job counts as passing.
- **Only PRs into `dev` and `main` trigger CI** (`pull_request.branches: [dev, main]`). PRs stacked on other branches no longer run it. Releases and hotfixes into `main` still do.
- **Kept as is:**
  - drafts don't run;
  - `opened`, `synchronize` and `ready_for_review` trigger;
  - every validation step, version pin, SHA-pinned action and cache is unchanged.
- **New push cancels the previous run.** A new push to the same PR cancels the run in progress (`concurrency` per PR).
- **Docs and agent skills that name the old workflow files are updated:**
  - `docs/branch_protection.md`;
  - the root and app READMEs, including the three places the uv version must agree;
  - `.claude/skills/pr-review/SKILL.md`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `continuous-integration`:
  - the frontend and API pipelines run in one workflow, each only when its app (or the workflow) changed;
  - change detection is defined, and fails open;
  - triggers are limited to PRs into `dev` and `main`;
  - concurrency per PR;
  - required checks are satisfied by a job skipped through its condition, never by a workflow skipped by a trigger filter.

## Impact

- **Workflows:**
  - added: `.github/workflows/ci.yml`;
  - removed: `.github/workflows/api.yml` and `.github/workflows/frontend.yml`.
- **Repository settings:** none. The rulesets match job names, which don't change.
- **Docs:**
  - `docs/branch_protection.md`: the checks table and the drafts section;
  - root `README.md`: the CI line and the uv version locations;
  - `apps/api/README.md` and `apps/web/README.md`: their CI sections and the uv version locations.
- **Agent skills:** `.claude/skills/pr-review/SKILL.md`.
- **Dependabot:** the `github-actions` entry already covers `/` and keeps updating the SHA pins in `ci.yml`.
- **Behaviour people will notice:**
  - docs-only PRs show both checks as skipped, which counts as passed;
  - PRs into feature branches show no CI.
- **Not in scope:** deployment on merge (change 5) and Terraform checks (change 4, which adds its own job to this workflow).
