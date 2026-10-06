# Branch protection

Two branches are protected. `dev` is the default and integration branch: every
pull request targets it. `main` holds the latest release and only changes through a
release or a hotfix (see [Release and hotfix flow](#release-and-hotfix-flow)). The
two CI workflows exist to keep both green. Without protection those workflows are
advisory only: a red check does not stop a merge. This document describes the
protection, why each setting is what it is, and how to apply and verify it.

## The two required checks

Required checks are matched by **job name**, not workflow name. Getting this wrong
is the classic failure: the rule silently matches nothing and protects nothing.

| Required check (job name) | Workflow | File |
| --- | --- | --- |
| `Test and static checks` | `CI` | `.github/workflows/ci.yml` (job `api`) |
| `Type-check, lint, build` | `CI` | `.github/workflows/ci.yml` (job `web`) |

Copy those two strings exactly. They are the `jobs.<id>.name` values, and they are
what appears in the "Checks" list on a pull request. Because the match is by job
name, moving a job to another workflow file doesn't touch the rulesets, as long as
its `name` stays the same.

### Which checks run

One workflow, `CI`, runs for pull requests into `dev` and `main`, and nothing else.
Both branches need the checks: `dev` for features and back-merges, `main` for
releases and hotfixes. Its first job, `Detect changes`, reads the pull request's files
(the whole PR against its base) and selects the package jobs:

| The PR changes | Runs |
| --- | --- |
| `apps/api/**` | `Test and static checks` |
| `apps/web/**` | `Type-check, lint, build` |
| `infra/**` | `Terraform` (not a required check) |
| `.github/workflows/ci.yml` | all three |
| anything else only (docs, specs) | none |

`Terraform` (fmt, validate and mocked tests of `infra/terraform`) is not in the
rulesets. To require it, add its name to both rulesets' required checks; it doesn't
block other PRs, because it is skipped by its own condition when `infra/` doesn't
change ([suggested_deployment.md](suggested_deployment.md#making-the-terraform-check-required)).

A package job that isn't selected is **skipped by its own `if:`**, and a job skipped
that way counts as a passed required check. So a docs-only PR shows both checks as
skipped and can be merged. The filtering deliberately isn't a `paths:` filter on the
workflow: a workflow skipped by its trigger never reports, and the PR would wait on
"Expected — waiting for status" forever.

Detection fails open. If `Detect changes` fails (an API error, a timeout), or the PR
has more files than the API can list, every job runs. Without that rule, a
job skipped because what it depends on failed would also count as passed, and a
broken detection would let untested code merge.

When a file outside `apps/` starts affecting an app (a shared package, a root
lint config an app reads), add it to the classification in `ci.yml` in the same PR.

## The policy

| Setting | Value | Why |
| --- | --- | --- |
| Require a pull request before merging | on | Nothing reaches `main` or `dev` without a pull request. |
| Required approvals | **0** — see below | A deliberate concession to team size, not an oversight. |
| Dismiss stale approvals on new commits | on | An approval should describe the code that merges, not an earlier version of it. |
| Require status checks to pass | on | The two jobs above. |
| Require branches to be up to date before merging | **on** (applied 2026-09-24) — see the note below | |
| Block force pushes | on | History on both branches should be append-only. |
| Block deletions | on | |
| Enforce for administrators | on — see the caveat below | An exemption nobody uses is clutter; an exemption people do use is the policy. |

### Why required approvals is 0

GitHub does not let anyone approve their own pull request. With most changes here
opened by the same person, requiring even one approval means nothing can merge
until a second maintainer is available — which in practice means work sits, or
the rule gets bypassed, and a rule that gets bypassed is not a rule.

So the count is 0, deliberately. Be clear about what that does and does not leave
in place:

**Still enforced.** Changes must arrive through a pull request — nobody pushes
straight to `main` or `dev`. Both CI jobs must pass. Force pushes and branch deletion are
blocked. These are the properties that stop `main` from silently breaking.

**No longer enforced.** Nothing requires a human to read the code. A pull request
with green checks and zero reviews can merge.

That second point has a specific consequence for the dependency policy. The
Dependabot design says every update passes CI *and* human review before landing.
Automerge is off, so no bot merges anything on its own — but with 0 required
approvals there is nothing stopping a person from merging a dependency bump
without reading it. **That half of the policy is now discipline, not
configuration.** Grouped minor/patch pull requests are the ones to watch: they are
routine enough to wave through and wide enough to carry something that matters.

Raise this to 1 when a second reviewer is reliably available. It is one setting,
and it costs nothing to change back.

### Why "require branches up to date" starts off

This setting (`strict` in the API) forces every pull request to be rebased onto the
latest commit of its base branch before it can merge, and re-run CI after each rebase. It is the right
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

**Deploys aren't checks.** The `Deploy` workflow runs after a merge into `dev`, never
on pull requests, so it can't block a merge; a failed deploy rolls back and shows up
as a failed run on `dev` ([suggested_deployment.md](suggested_deployment.md#continuous-deployment)).

### Draft pull requests don't run CI

Every job in `CI` carries `github.event.pull_request.draft == false` in its `if:`,
so on a draft they are all skipped. The package jobs repeat it on purpose: on a draft
`Detect changes` is skipped, which their fail-open rule would otherwise read as
"detection failed, run everything". A draft can't be merged anyway. Marking it
**ready for review** triggers a run (`ready_for_review` is one of the workflow's
event types), and the checks then report for real. If someone reports a PR whose
checks never ran, that is the first thing to look at. The second is its base branch:
only PRs into `dev` and `main` run CI.

A new push to a pull request cancels its run in progress, so the checks always
describe the latest commit.

## Release and hotfix flow

- **Release:** open a pull request from `dev` into `main` and merge it with a
  **merge commit**, never a squash or rebase. A squash gives `main` a commit that
  `dev` does not have, so the next release pull request carries the same changes
  again and conflicts.
- **Hotfix:** for a fix that can't wait for the next release:
  1. branch from `main` and open a pull request into `main`;
  2. once it merges, open a pull request from `main` into `dev` (merge commit
     again), so the next release does not revert the fix.

  Security fixes that production can't wait for take this path. The matching
  Dependabot PR on `dev` is then merged too, or closed once the back-merge lands.

Because both branches block direct pushes, every one of these steps is a pull
request with green checks, including the `main` → `dev` back-merge.

## How to apply it

Two options. A **ruleset** is the modern mechanism and the one in use: it can be
scoped, layered, and exported. **Classic branch protection** is simpler and is what
the second REST snippet below uses.

> **Target branches by name, never "default branch".** A ruleset that targets
> `~DEFAULT_BRANCH` follows whichever branch is the default. When the default moved
> from `main` to `dev`, a ruleset like that would have moved with it and left
> `main` with no protection at all. Each ruleset here names its branch
> (`refs/heads/main`, `refs/heads/dev`), so changing the default can't move or
> remove anything.

### Option A — rulesets (in use)

There are two rulesets, `main protection` and `dev protection`, with the same rules.
They are separate so `main`, the release gate, can tighten on its own later, for
example to require an approval, without splitting a shared ruleset first.

Settings → Rules → Rulesets → New branch ruleset, once per branch:

1. **Name**: `main protection` or `dev protection`. **Enforcement status**: Active.
2. **Target branches**: Add target → Include by pattern → `main` or `dev`. Do
   **not** use "Include default branch".
3. Enable **Restrict deletions** and **Block force pushes**.
4. Enable **Require a pull request before merging** → required approvals `0` (see
   above), **Dismiss stale pull request approvals when new commits are pushed** on.
5. Enable **Require status checks to pass** → add both job names from the table
   above, and check **Require branches to be up to date before merging**.
6. Leave **Bypass list** empty (this is the ruleset equivalent of enforcing for
   administrators).

The same thing through the API, for `dev` (swap the name and ref for `main`):

```bash
gh api -X POST repos/undp/monbo/rulesets --input - <<'JSON'
{
  "name": "dev protection",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["refs/heads/dev"], "exclude": [] } },
  "bypass_actors": [],
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    { "type": "pull_request", "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": true,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false } },
    { "type": "required_status_checks", "parameters": {
        "strict_required_status_checks_policy": true,
        "required_status_checks": [
          { "context": "Test and static checks", "integration_id": 15368 },
          { "context": "Type-check, lint, build", "integration_id": 15368 } ] } }
  ]
}
JSON
```

`integration_id` 15368 is GitHub Actions. Pinning it means only a check reported
by Actions can satisfy the rule.

### Option B — classic branch protection, via the API

Requires admin on the repository. Run it once per branch (`main`, then `dev`).

```bash
gh api -X PUT repos/undp/monbo/branches/main/protection --input - <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["Test and static checks", "Type-check, lint, build"]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": 0,
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
# 1. Each branch reports the rules that apply to it, with both contexts spelled
#    exactly. This endpoint covers rulesets; the classic
#    `branches/<b>/protection` endpoint returns 404 when only rulesets are in use.
for b in main dev; do
  echo "== $b"
  gh api repos/undp/monbo/rules/branches/$b --jq '.[] | .type,
    (.parameters.required_status_checks[]?.context)'
done

# 2. An open pull request reports both checks as required.
gh pr view <number> --json statusCheckRollup \
  --jq '.statusCheckRollup[].name'
```

3. **Confirm a failing check actually blocks the merge.** Open a throwaway pull
   request that breaks something cheap and obvious — a deliberate type error in a
   frontend file is enough — mark it ready for review, and check that the merge
   button is disabled once CI goes red. Then close it. Until someone has seen a red
   check refuse a merge, the protection is assumed, not verified.
