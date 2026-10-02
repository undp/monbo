## 1. Labels

- [x] 1.1 Create the seven labels `.github/dependabot.yml` references: `dependencies`, `frontend`, `api`, `docker`, `github-actions`, `root-orchestrator`, `gfw-tmf-script`. Verify with `gh label list` that every `labels:` value in the file has a match

## 2. Config, docs and skills (one PR into `dev`, inert until the switch)

- [x] 2.1 Branch from `origin/dev`. In `.github/dependabot.yml`, add the `ignore` rules from design D5, each with a comment naming its entry condition and the archived decision (`dependency-upgrade-2026` D5, D10, R11, R16, Deferred):
  - `/monbo-front` npm: `@mui/*`, `@types/node`, `typescript` and `eslint`, each with `update-types: ["version-update:semver-major"]`;
  - `/monbo-front` docker: `node` semver-major;
  - `/monbo-api` docker: `python` with `versions: [">=3.14"]`;
  - `/scripts/update-gfw-tmf` uv: `gdal`, all updates
- [x] 2.2 Add `cooldown` (`default-days: 3`, `semver-major-days: 7`) to the two `npm` and the two `uv` entries (D6). Do **not** add `target-branch` to any entry (D4)
- [x] 2.3 Update the header comment of `dependabot.yml`: PRs open against the default branch `dev`, why there is no `target-branch`, and where the active deferrals are listed
- [x] 2.4 Validate the YAML: parse it, confirm seven entries with no `target-branch`, and check every `ignore`/`cooldown` key against the Dependabot options reference
- [x] 2.5 Root `README.md`:
  - a short note near the top: `dev` is the integration and default branch, and `main` holds the latest release;
  - the "Branch protection" line covers both branches;
  - the "Dependency update policy" section adds the cooldown, security updates, and a table of active deferrals with their entry conditions
- [x] 2.6 `docs/branch_protection.md`:
  - describe both rulesets and their by-name targets, and warn never to use `~DEFAULT_BRANCH` (D2);
  - add the release flow (`dev` → `main` with a merge commit) and the hotfix flow (`main` → `main`, then `main` → `dev`) from D3;
  - update the "How to apply it" and verification snippets for both branches
- [x] 2.7 `docs/onboarding.md`: branch from `dev`, PRs target `dev`, and `git remote set-head origin -a` for existing clones
- [x] 2.8 `.claude/skills/pr-review/SKILL.md`: required checks apply on `main` and `dev`. `.claude/skills/pr-comment-triage/SKILL.md`: add `dev` to the protected-branch gate. Its "pre-existing on `main`" wording becomes the PR's base branch
- [x] 2.9 Check the `monbo-front`, `monbo-api` and `scripts/update-gfw-tmf` READMEs for anything that says or implies PRs go to `main`
- [ ] 2.10 Open the PR into `dev`, and merge it once CI is green

## 3. Protection, then default branch (admin, in this order, design D2)

- [ ] 3.1 Export the current `main protection` ruleset (`gh api repos/undp/monbo/rulesets/<id>`) to `.context/` as a rollback reference
- [ ] 3.2 Retarget `main protection` from `~DEFAULT_BRANCH` to `refs/heads/main`, leaving its rules untouched. Verify with `gh api repos/undp/monbo/rules/branches/main` that `main` still reports deletion, non_fast_forward, pull_request and both required checks
- [ ] 3.3 Create the `dev protection` ruleset on `refs/heads/dev` with the same rules and an empty bypass list. Verify with `gh api repos/undp/monbo/rules/branches/dev`
- [ ] 3.4 Switch the default branch: `gh api -X PATCH repos/undp/monbo -f default_branch=dev`. Verify `.default_branch == "dev"`, then re-run the checks from 3.2 and 3.3 to confirm neither branch's rules moved
- [ ] 3.5 Confirm a direct push to `dev` is rejected, for example with `git push --dry-run` of a throwaway commit, or by checking the rules API reports `pull_request` for `dev`

## 4. Security updates

- [ ] 4.1 Enable Dependabot security updates (`gh api -X PUT repos/undp/monbo/automated-security-fixes`), and confirm `enabled: true` with a GET
- [ ] 4.2 Within a day, check that an `anyio` security PR opened against `dev`. If not, apply the D7 fallback: on a branch from `origin/dev`, run `uv lock --upgrade-package anyio` in `monbo-api`, confirm `pyproject.toml` is unchanged, run the API tests, and open the PR with `--base dev`
- [ ] 4.3 Bring the design's open questions to the user: ship `anyio` as a hotfix or not, and the `cryptography` 49 → 50 PR for `scripts/update-gfw-tmf`

## 5. Reset the PR queue (design D8)

- [ ] 5.1 Close #24 (`python:3.14-slim`), #33 (`@types/node` 26), #34 (`@mui/material-nextjs` 9) and #40 (`node:26-alpine`). Each gets a comment naming the deferral and the `ignore` rule that now covers it
- [ ] 5.2 Close #26, #27, #28, #29, #32, #36 and #37 with a comment saying they will reopen against `dev`. The comment on #36 notes that only geemap comes back, since `gdal` is now ignored
- [ ] 5.3 Trigger "Check for updates" for each of the seven entries (Insights → Dependency graph → Dependabot)
- [ ] 5.4 Retarget #9, #12 and #13 to `dev` (`gh pr edit <n> --base dev`), and leave a comment for their authors about the new flow and any conflicts

## 6. Verify the first run under the new setup

- [ ] 6.1 Every new Dependabot PR, version and security, has `dev` as its base and carries its labels, with no "labels could not be found" comment
- [ ] 6.2 Replacements exist on `dev` (or are pending cooldown) for:
  - checkout 7.0.1 and pnpm/action-setup 6.1.0;
  - setup-uv 10 and setup-node 7;
  - `concurrently` 10.0.5, which resolves the high `shell-quote` alert;
  - `@types/google.maps` 3.66.4;
  - uvicorn 0.54, ruff 0.16 and mypy 2.3;
  - geemap 0.38.8
- [ ] 6.3 None of the deferred upgrades is reproposed:
  - `@mui/*` 9, `@types/node` 26, `node:26`;
  - `python:3.14`, including inside a group;
  - `gdal`.

  If `python` 3.14 still appears, switch that rule to the fallback in design (Risks) and re-run
- [ ] 6.4 Review and merge the replacement PRs into `dev` one at a time, checking for conflicts with what `dev` already has (`monbo-api/uv.lock` after #35)
- [ ] 6.5 Record the real-run verification that closes `dependency-upgrade-2026` task 11.8 in the root README policy section or this change's notes:
  - seven ecosystems are picked up;
  - `uv` moves `pyproject.toml` and `uv.lock` together (#37);
  - Docker detects `Dockerfile.dev` and `Dockerfile.prod` (#24 and #40 touched both)
