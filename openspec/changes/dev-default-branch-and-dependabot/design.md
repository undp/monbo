## Context

`dependency-upgrade-2026` added `.github/dependabot.yml` as its final PR (D8). On 2026-10-01 the repository adopted a long-lived `dev` integration branch: features branch from and merge into `dev`, and `main` only changes on a production release. The repository's default branch stayed `main`, so Dependabot, PR defaults and branch protection all still point there.

The first Dependabot runs (2026-09-24 → 2026-09-30) produced eleven open PRs and three closed ones. Reviewing them against the archived design surfaced four problems besides the branch:

- **Deferred upgrades were never encoded.** The design defers MUI 9, TypeScript 7, eslint 10, Python 3.14 and Node 26 with explicit entry conditions, and D5 rejects `@types/node` 26 outright. None of that reached the bot, so it opened:
  - #34, `@mui/material-nextjs` 9.4.0. It was offered alone because the adapter declares no `@mui/material` peer.
  - #33, `@types/node` 26.
  - #40, `node:26-alpine`.
  - #24, `python:3.14-slim`, which landed inside the `minor-and-patch` group because Dependabot reads the Docker tag `3.13 → 3.14` as a minor.

  CI passed on #24 and #40, but that proves nothing: CI does not build the Docker images, and it runs Python 3.13 and Node 24.
- **Labels are missing.** None of the seven labels the configuration references exist, and Dependabot comments a warning on each PR.
- **Security updates are off.** `automated-security-fixes` is `enabled: false`, so no PR exists for any of the 30 open alerts. The critical and high `anyio` alerts in `monbo-api/uv.lock` (4.14.1, fixed in 4.14.2) are on a transitive dependency, which version updates never touch.
- **The GFW/TMF script's `gdal` was bumped (#36).** The script declares `GDAL>=3.6.0` on purpose, because the bindings must match the operator's system `libgdal` (R11, task 5.4 still open). A lock bump moves that target for whoever regenerates the rasters next.

Four GitHub behaviours shape the design:

1. **Dependabot reads `.github/dependabot.yml` only from the default branch.**
2. **Security updates always open against the default branch.** `target-branch` only redirects version updates. Setting it also detaches the entry's options from security updates: they no longer apply `labels`, `ignore` and the rest.
3. **The only ruleset, `main protection`, targets `~DEFAULT_BRANCH`, not `main` by name.** It requires a PR, both CI checks with strict up-to-date, and blocks force pushes and deletions. Changing the default branch moves all of that to the new default and leaves `main` with nothing.
4. **Dependabot alerts and the dependency graph are computed for the default branch.**

## Goals / Non-Goals

**Goals:**
- `dev` is the default branch, and everything that follows the default branch, Dependabot included, lands in `dev` first.
- `main` and `dev` are both protected, by name, before and after the switch, with no window where `main` is unprotected.
- Every upgrade deferred by `dependency-upgrade-2026` stays deferred until its entry condition is met, and the reason lives next to the rule.
- Labels resolve, security updates run, and the critical `anyio` alert is closed.
- The open PR queue is reset to the new flow.

**Non-Goals:**
- Doing any of the deferred upgrades: MUI 9, TypeScript 7, eslint 10, Python 3.14, Node 26.
- Deciding the GDAL strategy (task 5.4). This change only stops the bot from moving it.
- Raising required approvals above 0 (`dependency-upgrade-2026` task 1.15). The new `dev` ruleset copies today's policy.
- Fixing the transitive frontend alerts (`brace-expansion`, `minimatch`, `tmp`, …) or `xlsx`. Security updates will propose what is fixable, and `xlsx` remains documented debt.
- Adding a Docker build to CI. It would make #24/#40-style PRs meaningful, but it is its own change.
- Automating releases or tags.

## Decisions

### D1 — `dev` becomes the default branch

Options considered:

- **A. Keep `main` as default, land the Dependabot config on `main` as a one-off exception, and back-merge every security PR into `dev`.** It works, but it makes two permanent exceptions to the flow. Every security fix would reach `main` before `dev`, and every new PR would keep defaulting to `main`, which is how #9, #12 and #13 ended up there.
- **B. Make `dev` the default branch.** ✅ Chosen. It is the usual setup for a repository with a long-lived integration branch. Dependabot (config, version and security updates), the PR base, closing keywords and the landing page all follow the branch where work actually lands, and the exceptions in A disappear.

What B costs, accepted deliberately:

- **The public landing page shows `dev`,** which is unreleased code. → The README states near the top that `dev` is the integration branch and `main` is the latest release.
- **Alerts describe `dev`, not production.** A vulnerability fixed in `dev` stays live in production until the next release. → Critical fixes for production use the hotfix path (D3).
- **Local clones keep `origin/HEAD` on `main`.** → One command, documented in onboarding.

### D2 — Protection names both branches; it never targets `~DEFAULT_BRANCH`

- The existing `main protection` ruleset is retargeted from `~DEFAULT_BRANCH` to `refs/heads/main`. Its rules stay as they are.
- A new ruleset, `dev protection`, targets `refs/heads/dev` with the same rules:
  - restrict deletions and block force pushes;
  - require a PR with 0 approvals and stale approvals dismissed;
  - require both checks (`Test and static checks`, `Type-check, lint, build`) with the strict up-to-date policy;
  - an empty bypass list.

**Two rulesets, not one with two targets.** One ruleset covering both branches would be less config, but the two branches have different jobs. `main` is the release gate and is the obvious place to require an approval first, once a second reviewer exists. Separate rulesets let it diverge without first splitting a shared one.

**Never `~DEFAULT_BRANCH`.** Naming branches explicitly means a future default-branch change can't silently unprotect anything. That is exactly the trap this change would otherwise have fallen into.

**Order is the safety property.** Both rulesets are active and verified before the default branch changes, so at no point is `main` unprotected.

**Consequence for `dev`:** direct pushes stop. That includes the `main` → `dev` push done on 2026-10-02. Back-merges become PRs from `main` into `dev`.

### D3 — Releases and hotfixes

- **Release:** a PR from `dev` into `main`, **merged with a merge commit**. A squash would give `main` a commit `dev` doesn't have, and the next release PR would carry the same changes twice and conflict. This is the same reasoning `docs/branch_protection.md` already applies to stacked PRs.
- **Hotfix:**
  1. a branch from `main` with a PR into `main`;
  2. once merged, a PR from `main` into `dev` so the fix isn't lost or reverted by the next release.

  Security fixes that can't wait for a release use this path. The Dependabot PR on `dev` is then either merged too, or closed as superseded once the back-merge lands.
- `pr-comment-triage`'s protected-branch gate adds `dev` to the branches it refuses to commit on. Its head-branch check protects release PRs (`dev` → `main`) the same way it already protects `main`.

### D4 — No `target-branch` in `dependabot.yml`

With `dev` as the default branch, every entry already targets `dev`. Setting `target-branch: "dev"` anyway would be redundant, and it would make the entry's options apply only to version updates (Context, behaviour 2). Security updates would then lose the entry's labels. Leaving it out keeps one configuration for both kinds of update.

### D5 — Deferrals become `ignore` rules, each with its entry condition

| Entry | Rule | Entry condition (from `dependency-upgrade-2026`) |
|---|---|---|
| `npm /monbo-front` | `@mui/*` semver-major | Visual-regression harness in place (D5, Deferred) |
| `npm /monbo-front` | `@types/node` semver-major | Runtime moves past Node 24 (D5): lift together with the Docker `node` rule |
| `npm /monbo-front` | `typescript` semver-major | typescript-eslint admits TS 7 and `eslint-config-next` adopts it (D10) |
| `npm /monbo-front` | `eslint` semver-major | `eslint-plugin-react` and `eslint-plugin-jsx-a11y` support eslint 10 (R16) |
| `docker /monbo-front` | `node` semver-major | One release cycle of soak after Node 26 LTS (2026-10-28) |
| `docker /monbo-api` | `python` `versions: [">=3.14"]` | Appetite: the wheels already exist (Deferred list) |
| `uv /scripts/update-gfw-tmf` | `gdal`, all updates | Task 5.4 decides the system GDAL strategy (R11) |

- **`@mui/*` as a wildcard, not just `@mui/material`.** #34 showed the family can drift one package at a time. Ignoring the major for the whole scope keeps core, icons and the Next adapter on the same major.
- **Python needs a version range; Node can use semver-major.** Docker tag `3.14` is a minor of `3.13`, so `update-types: semver-major` would not catch it, while `node:24 → 26` is a real major.
- **`typescript` and `eslint` rules are preventive.** Dependabot has not proposed them, probably because of peer conflicts, but nothing guarantees it won't once a peer range widens without the full chain being ready.

Each rule carries a YAML comment naming the entry condition and pointing to the archived design. Lifting a deferral then means deleting a commented rule, not rediscovering why it existed.

**Alternative:** `@dependabot ignore this major version` on each closed PR. Rejected because those ignores live in GitHub's state, not the repo. They are invisible in review and can't carry a reason.

### D6 — `cooldown` on the `npm` and `uv` entries

```yaml
cooldown:
  default-days: 3
  semver-major-days: 7
```

This closes task 11.9. It is the bot-side version of what pnpm 12's `minimumReleaseAge` enforced (R14): a release has a few days to be yanked or flagged before a PR proposes it. Majors wait longer because they are reviewed one at a time anyway. Docker and Actions are left without cooldown: the tags move slowly, and Actions are SHA-pinned. Cooldown never applies to security updates, so it cannot delay a fix.

**Alternative:** no cooldown, which leaves the R14 exposure open. Or a longer window such as 7/14, which is more delay than a weekly cadence needs.

### D7 — Security updates on; `anyio` through them, by hand only as a fallback

Dependabot security updates are switched on once `dev` is the default, so their PRs open against `dev` like everything else. The 30 accumulated alerts show that leaving them off and relying on people to read alerts does not work.

The critical `anyio` alert should get a security PR as soon as the feature is on. If none appears within a day, it is fixed by hand on a branch from `dev`. That can happen because the dependency is transitive in a `uv` project, and Dependabot's coverage there is newer. The manual fix is `uv lock --upgrade-package anyio` in `monbo-api` (4.14.1 → 4.14.2 or later), with `pyproject.toml` unchanged. Production keeps 4.14.1 until the next release, unless it is shipped as a hotfix (D3). Whether it should be is an open question.

### D8 — Reset the open PR queue instead of retargeting

Dependabot does not move existing PRs to a new base. Changing a Dependabot PR's base by hand counts as "altering" it, and Dependabot stops rebasing PRs that were altered. So all eleven Dependabot PRs are closed once `dev` is the default and holds the new config, each with a comment saying why. Then each ecosystem's "Check for updates" is triggered. Expected result:

- **Back on `dev`:**
  - Actions: checkout 7.0.1, pnpm/action-setup 6.1.0, setup-uv 10, setup-node 7;
  - `concurrently` 10.0.5, which also resolves the high `shell-quote` alert;
  - `@types/google.maps` 3.66.4;
  - uvicorn 0.54, ruff 0.16, mypy 2.3;
  - geemap 0.38.8.
- **Not reproposed:** #24, #33, #34 and #40, plus the `gdal` half of #36.

The cooldown may hold back some of these for a few days. That is expected.

The human PRs #9, #12 and #13 are different. They aren't Dependabot's, so their base can be edited directly to `dev`. Any conflicts with what `dev` already has are for their authors to resolve.

## Risks / Trade-offs

- **Ruleset change leaves `main` briefly unprotected.** → Retarget `main protection` to `refs/heads/main` *before* touching the default branch, and verify with the API that `main` still reports its rules. Only then switch.
- **The config is read from `dev` the moment it becomes the default.** If the old config (no ignores) is what `dev` holds at that moment, the next run reproposes the deferred upgrades against `dev`. → Merge the new `dependabot.yml` into `dev` first, while it is still inert, and switch the default after.
- **Release PRs carry everything on `dev`.** A half-finished feature on `dev` blocks a release. → Unchanged by this change: that is the existing `dev`/`main` model. The hotfix path covers urgent fixes.
- **A squashed release breaks the next one.** → D3 requires merge commits for release and back-merge PRs, and `docs/branch_protection.md` says so.
- **Ignore rules outlive their reason.** A deferral that is never revisited is a silent freeze. → Each rule names its entry condition. The README lists active deferrals, so they are reviewed at each release. Node 26 has a date (soak after 2026-10-28).
- **Ignore rules also silence security updates.** The Dependabot options reference marks `ignore` as applying to both kinds of update. A vulnerability whose only fix is an ignored major (say a future `@mui/*` advisory fixed only in 9.x), or any `gdal` advisory, gets an alert but no PR. → The alert still shows in the Security tab. Reviewing open alerts is part of each release, the same moment the deferral list is reviewed.
- **The Docker `versions` range for Python may not behave as expected with suffixed tags** (`3.13-slim`). → Verified on the first run (task). If it fails, fall back to `dependency-name: "python"` with `update-types: ["version-update:semver-minor", "version-update:semver-major"]`.
- **ruff 0.16 rides in a "minor" group.** In 0.x, ruff minors can add or change rules. → CI runs ruff, so a breaking rule fails the grouped PR rather than landing silently. Not ignored.
- **Agents and docs keep assuming `main`.** → The two skills and `docs/branch_protection.md` are updated in the same PR as the config. Conductor workspaces already target `origin/dev`.

## Migration Plan

1. Create the seven labels.
2. Open a PR **into `dev`** with:
   - `dependabot.yml`: ignores, cooldown and header comment;
   - the README, `docs/branch_protection.md` and `docs/onboarding.md` updates;
   - the two skill updates.

   Merge it. It stays inert while `main` is the default.
3. Retarget `main protection` to `refs/heads/main`, and verify `main` still reports its rules.
4. Create `dev protection` on `refs/heads/dev`, and verify `dev` reports its rules.
5. Switch the default branch to `dev`, and verify it with the API.
6. Enable Dependabot security updates.
7. Close the eleven Dependabot PRs with explanatory comments, trigger "Check for updates" for each ecosystem, and retarget #9, #12 and #13 to `dev`.
8. Verify the new PRs:
   - they target `dev` and carry their labels;
   - the deferred upgrades are not reproposed;
   - the `python` range works;
   - an `anyio` security PR appears, or apply the D7 fallback.
9. Record the task 11.8 verification.

**Rollback:**
- Switch the default back to `main`.
- `main protection` already targets `main` by name, so it keeps working. `dev protection` can stay or be disabled.
- Dependabot then reads `main`'s config again, which predates this change.

## Open Questions

- **Should the `anyio` fix ship to production as a hotfix (D3)** rather than with the next release? It is critical, but whether it is reachable depends on how the API is exposed.
- **What to do about the high `cryptography` alert in `scripts/update-gfw-tmf`** (49 → 50, a major on a transitive)? It will arrive as a security PR. Accept it, or does it need the script exercised by hand first?
- **Who owns reviewing the deferral list** at each release, given required approvals is 0 (`dependency-upgrade-2026` task 1.15)?
