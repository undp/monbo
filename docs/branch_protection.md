# Branch protection

`main` is the branch every release is cut from, and the two CI workflows exist to
keep it green. Until branch protection is configured those workflows are advisory
only: a red check does not stop a merge. This document describes the protection to
apply, why each setting is what it is, and how to apply it.

## The two required checks

Required checks are matched by **job name**, not workflow name. Getting this wrong
is the classic failure: the rule silently matches nothing and protects nothing.

| Required check (job name) | Workflow | File |
| --- | --- | --- |
| `Test and static checks` | `API CI` | `.github/workflows/api.yml` |
| `Type-check, lint, build` | `Frontend CI` | `.github/workflows/frontend.yml` |

Copy those two strings exactly. They are the `jobs.<id>.name` values, and they are
what appears in the "Checks" list on a pull request.

## The policy

| Setting | Value | Why |
| --- | --- | --- |
| Require a pull request before merging | on | Nothing reaches `main` without review. |
| Required approvals | 1 | Matches the Dependabot policy: every update is reviewed by a human, nothing automerges. |
| Dismiss stale approvals on new commits | on | An approval should describe the code that merges, not an earlier version of it. |
| Require status checks to pass | on | The two jobs above. |
| Require branches to be up to date before merging | **on** (applied 2026-09-24) — see the note below | |
| Block force pushes | on | History on `main` should be append-only. |
| Block deletions | on | |
| Enforce for administrators | on — see the caveat below | An exemption nobody uses is clutter; an exemption people do use is the policy. |

### Why "require branches up to date" starts off

This setting (`strict` in the API) forces every pull request to be rebased onto the
latest `main` before it can merge, and re-run CI after each rebase. It is the right
end state, but turning it on while a stack of dependent pull requests is landing
means each merge invalidates everything above it — each one has to be updated and
re-tested in turn, serially.

**Applied as on.** That is the right end state, so the note above is about
sequencing rather than correctness. While the current stack of dependent pull
requests lands, expect to click "Update branch" on each one after the one below
it merges, and to wait for CI again.

One consequence worth planning around: **land the stack with merge commits, not
squashes.** Each pull request in the chain contains the commits of the one below
it. A merge commit leaves those commits recognisable, so the next pull request
needs only a sync. A squash replaces them with a single new commit that the next
pull request does not have, while still carrying the originals — which turns a
one-click sync into a conflict-prone rebase.

### The caveat on "enforce for administrators"

With this on, nobody can merge past a red check — including when the check is red
for a reason that has nothing to do with the change. That is not hypothetical here:
the frontend build downloads Roboto from Google Fonts at build time, and on
2026-09-23 a pull request whose entire diff was one YAML file and four READMEs
failed because that download returned something the font loader could not parse. It
passed on rerun.

So enabling admin enforcement is correct, but it makes the build's external network
dependency everyone's problem. Removing that dependency is tracked separately, and
the fix is already paid for: `@fontsource/roboto` is a declared dependency that
nothing imports — a self-hosted copy of the same font sitting unused. Prefer fixing
that over leaving an admin bypass open.

### Draft pull requests never report

Both workflows are configured to skip drafts:

```yaml
on:
  pull_request:
    types: [opened, synchronize, ready_for_review]
# ...
    if: github.event.pull_request.draft == false
```

A required check that never runs leaves the pull request blocked on
"Expected — waiting for status", forever. This is intended: a draft is not meant to
be merged. But it does mean a pull request must be **marked ready for review**
before its checks appear at all. If someone reports a PR "stuck waiting for checks",
that is the first thing to look at.

## How to apply it

Two options. A **ruleset** is the modern mechanism and the one to prefer: it can be
scoped, layered, and exported. **Classic branch protection** is simpler and is what
the REST snippet below uses.

### Option A — ruleset (recommended)

Settings → Rules → Rulesets → New branch ruleset:

1. **Name**: `main protection`. **Enforcement status**: Active.
2. **Target branches**: Include default branch.
3. Enable **Restrict deletions** and **Block force pushes**.
4. Enable **Require a pull request before merging** → required approvals `1`,
   **Dismiss stale pull request approvals when new commits are pushed** on.
5. Enable **Require status checks to pass** → add both job names from the table
   above. Leave **Require branches to be up to date before merging** unchecked for
   now.
6. Leave **Bypass list** empty (this is the ruleset equivalent of enforcing for
   administrators).

### Option B — classic branch protection, via the API

Requires admin on the repository.

```bash
gh api -X PUT repos/undp/monbo/branches/main/protection --input - <<'JSON'
{
  "required_status_checks": {
    "strict": false,
    "contexts": ["Test and static checks", "Type-check, lint, build"]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON
```

## Verifying it actually protects

Configuring the rule is not the same as it working — most commonly the check names
do not match and the rule matches nothing. Confirm all three:

```bash
# 1. The rule exists and lists both contexts, spelled exactly.
gh api repos/undp/monbo/branches/main/protection \
  --jq '.required_status_checks.contexts, .enforce_admins.enabled'

# 2. An open pull request reports both checks as required.
gh pr view <number> --json statusCheckRollup \
  --jq '.statusCheckRollup[].name'
```

3. **Confirm a failing check actually blocks the merge.** Open a throwaway pull
   request that breaks something cheap and obvious — a deliberate type error in a
   frontend file is enough — mark it ready for review, and check that the merge
   button is disabled once CI goes red. Then close it. Until someone has seen a red
   check refuse a merge, the protection is assumed, not verified.
