## Why

Since 2026-10-01 all integration happens in `dev` and `main` only receives releases, but `main` is still the repository's default branch. Everything GitHub does "on the default branch" therefore works against the flow:

- Dependabot reads its configuration from `main` and opens every PR there;
- security updates can only target `main`;
- new PRs default to `main`, and three old ones (#9, #12, #13) still target it;
- the only branch ruleset targets "the default branch", so `dev` has no protection at all.

Dependabot's first week of runs (#24–#40) also showed that the policy written in `dependency-upgrade-2026` never reached the bot's configuration. It proposed four upgrades that change explicitly deferred (MUI 9, `@types/node` 26, Node 26, Python 3.14). The labels it was told to apply do not exist, and security updates are disabled while the repository carries 30 open alerts, one of them critical (`anyio` in `monbo-api`).

## What Changes

- **`dev` becomes the default branch of `undp/monbo`.** Dependabot, both version and security updates, new PRs and closing keywords all follow it, so they reach `main` only through a release.
- **Branch protection names its branches.** Today's `main protection` ruleset targets `~DEFAULT_BRANCH`, which would silently move to `dev` and leave `main` unprotected. It is retargeted to `refs/heads/main` by name. A new `dev protection` ruleset gives `dev` the same rules. Both are in place before the default branch changes.
- **Releases and hotfixes get a defined path:**
  - a release is a PR from `dev` into `main`, merged with a merge commit;
  - a hotfix branches from `main`, merges into `main`, and `main` is then merged into `dev`.
- **Deferred upgrades are encoded as `ignore` rules**, each one commented with the entry condition from `dependency-upgrade-2026/design.md`:
  - `monbo-front`: semver-major updates of `@mui/*`, `@types/node`, `typescript` and `eslint`;
  - Docker: `node` majors in `/monbo-front`, and `python` >= 3.14 in `/monbo-api`, because a tag bump like `3.13 → 3.14` counts as a minor and slipped into the `minor-and-patch` group;
  - `scripts/update-gfw-tmf`: every `gdal` update, until task 5.4 (system GDAL strategy, R11) is decided.
- **A `cooldown` is added** to the `npm` and `uv` entries, closing task 11.9 of `dependency-upgrade-2026`.
- **Repository setup:**
  - create the labels the configuration references;
  - enable Dependabot security updates, which now open against `dev`.
- **Open PRs are triaged:**
  - the eleven Dependabot PRs target `main` and are closed;
  - the ones worth keeping (#26, #27, #28, #29, #32, #37, and geemap from #36) come back against `dev`;
  - #24, #33, #34 and #40 are closed as deferred;
  - #9, #12 and #13 are retargeted to `dev`.
- **Docs and agent skills that say "`main` is the protected branch" are updated** to describe both branches and the release flow.
- **The real-run verification is recorded** (task 11.8 of `dependency-upgrade-2026`), based on what the first runs showed.

## Capabilities

### New Capabilities
- `branch-flow`:
  - `dev` is the default and integration branch, and `main` is release-only;
  - how releases and hotfixes move between the two branches.

### Modified Capabilities
- `automated-dependency-updates`:
  - all Dependabot PRs, version and security, open against the default branch `dev`;
  - upgrades deferred by a design decision must be encoded as `ignore` rules with their entry condition;
  - npm and uv updates wait out a release cooldown;
  - security updates must be enabled;
  - labels referenced by the configuration must exist.
- `continuous-integration`: the required-checks requirement now protects `main` and `dev` explicitly by name, instead of whichever branch is the default.

## Impact

- **Repository settings (admin):**
  - default branch `main` → `dev`;
  - ruleset `main protection` retargeted to `refs/heads/main`, plus a new `dev protection` ruleset;
  - seven new labels: `dependencies`, `frontend`, `api`, `docker`, `github-actions`, `root-orchestrator`, `gfw-tmf-script`;
  - Dependabot security updates switched on.
- **Config:** `.github/dependabot.yml`.
- **Docs:**
  - root `README.md`: branch protection line, "Dependency update policy" section, and a note on branches;
  - `docs/branch_protection.md`;
  - `docs/onboarding.md`;
  - pointers in the package READMEs if they mention the target branch.
- **Agent skills:**
  - `.claude/skills/pr-review/SKILL.md`, which says "required checks on `main`";
  - `.claude/skills/pr-comment-triage/SKILL.md`, whose protected-branch gate lists `main` but not `dev`.
- **Behaviour people will notice:**
  - direct pushes to `dev` are no longer possible, so everything goes through a PR with green CI;
  - the GitHub landing page and README show `dev`, which is unreleased code;
  - Dependabot alerts and the dependency graph describe `dev`, not what is deployed;
  - existing local clones keep `origin/HEAD` on `main` until they run `git remote set-head origin -a`.
- **Unaffected:** deployment. `azure/deploy.sh` builds from the local checkout's `HEAD`, not from a branch.
- **GitHub PRs:**
  - closed: #24, #26, #27, #28, #29, #32, #33, #34, #36, #37 and #40;
  - retargeted: #9, #12 and #13.
