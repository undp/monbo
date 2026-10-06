## Context

Two workflows validate pull requests today:

| Workflow | File | Job name (required check) | Runs in |
|---|---|---|---|
| API CI | `.github/workflows/api.yml` | `Test and static checks` | `apps/api` |
| Frontend CI | `.github/workflows/frontend.yml` | `Type-check, lint, build` | `apps/web` |

Both trigger on `pull_request` (`opened`, `synchronize`, `ready_for_review`) with no branch or path filter, and skip drafts with a job-level `if`. The rulesets `dev protection` and `main protection` require both job names, reported by GitHub Actions (`integration_id` 15368), with "require branches up to date" on.

This is change 3 of 5 in the infra roadmap. Change 4 will add Terraform checks and change 5 a deploy workflow, and both build on the pattern chosen here.

GitHub's rules for required checks that drive this design:

- **Workflow skipped** by a trigger filter (`paths`, `branches`): the check is never created, and the PR waits on "Expected — waiting for status".
- **Job skipped** by its `if:` condition: it reports success and satisfies the required check.
- **Job skipped** because a job in its `needs:` failed: it also shows as skipped. Without care, a failure upstream turns into a green required check.

## Goals / Non-Goals

**Goals:**

- A PR only runs the package jobs for the apps it changes. Docs-only PRs run neither and stay mergeable.
- CI runs only for PRs into `dev` and `main`, and releases and hotfixes into `main` keep working.
- No path to a green required check without the tests having run when they should have.
- No ruleset change. Same validation steps, pins and caches.

**Non-Goals:**

- Push-to-`dev` deploys (change 5) and Terraform validation (change 4).
- Changing what each job validates. The Google Fonts flakiness (task 12.7) is fixed separately.
- Merge queue, required approvals, coverage thresholds.

## Decisions

### D1. One workflow, job-level filtering, unchanged job names

`ci.yml` holds three jobs: `changes`, `api` (name "Test and static checks") and `web` (name "Type-check, lint, build"). The package jobs carry the filtering in their `if:`, so a skipped job reports success. The workflow trigger has no `paths:`.

- **Alternative: keep two workflows, each with `paths:`.** Rejected: a skipped workflow leaves its required check pending forever, which is the exact failure the drafts section of `branch_protection.md` warns about.
- **Alternative: a single "CI passed" aggregator job as the only required check.** Cleaner long term, but it needs a ruleset change and another job to keep correct. The two names already work, and change 4 can revisit it when a third check appears.

### D2. Detection from the PR's file list, no third-party action

`changes` calls `gh api repos/{repo}/pulls/{number}/files --paginate`, with the default `GITHUB_TOKEN` and `permissions: pull-requests: read`. It classifies paths with plain shell:

- `apps/api/` prefix → `api=true`;
- `apps/web/` prefix → `web=true`;
- `.github/workflows/ci.yml` → both.

It needs no checkout. The list covers the whole PR against its base, not the last push, so a PR that starts as docs-only and later touches the API runs the API job on that push.

- **Alternative: `dorny/paths-filter`.** Popular and SHA-pinnable, but it is third-party code in the job that decides whether required checks run, and the logic is a few lines of shell.
- **Alternative: `git diff base...head`.** Needs a checkout with enough history (`fetch-depth: 0` on a repository with LFS history). The API needs none.

### D3. Fail-open, written into the conditions

Each package job runs when:

```
github.event.pull_request.draft == false
&& !cancelled()
&& (needs.changes.result != 'success' || needs.changes.outputs.<pkg> == 'true')
```

- **`!cancelled()`:** the job is evaluated even when `changes` failed. By default, a failed `needs` skips the job, which would read as success.
- **`needs.changes.result != 'success'`:** a failed detection runs the job.
- **Draft check repeated at job level:** on a draft `changes` is skipped, so its result is not `success`, and without this clause the fail-open branch would run the jobs.

`changes` also forces both outputs to `true` when the file list is incomplete. The PR files API returns at most 3,000 files; at that count, assume everything changed.

### D4. Triggers: PRs into `dev` and `main` only

```yaml
on:
  pull_request:
    types: [opened, synchronize, ready_for_review]
    branches: [dev, main]
```

`branches` filters the base branch. Both protected branches require these checks: `dev` for features and back-merges, `main` for releases and hotfixes. PRs into any other base, such as stacked PRs, get no CI. They don't need it, because CI runs when the stack lands on `dev`. The workflow-level skip is safe there because no ruleset protects those bases.

### D5. Concurrency per pull request

`concurrency: { group: ci-${{ github.event.pull_request.number }}, cancel-in-progress: true }`. Pushing again cancels the superseded run. The newest run reports the checks for the newest head SHA, which is the one that "require up to date" evaluates.

### D6. Permissions

The workflow defaults to `permissions: {}`:

- `changes` gets `pull-requests: read`;
- the package jobs get `contents: read`.

Today's workflows run with the repository default token permissions, so this narrows them.

## Risks / Trade-offs

- **[Risk] A file that affects a package lives outside its folder** and doesn't trigger its job. Today there is none that CI would catch: `apps/api` has its own tool configuration, and the root `pyproject.toml` and orchestrator `package.json` aren't used by either job. → Mitigation: the filter is a short list in one place. When a shared file appears (for example `packages/` or a root lint config used by an app), it goes in the list in the same PR.
- **[Risk] Skipped-means-success is GitHub behaviour, not our code.** → Mitigation: verify it on real PRs before relying on it (tasks): a docs-only PR must be mergeable with both checks skipped. `branch_protection.md` currently says drafts stay "Expected — waiting", which contradicts this behaviour for job-level skips. The verification settles it and the doc is corrected.
- **[Risk] PRs opened before the `apps/` move list files under `monbo-api/` and `monbo-front/`, which select nothing.** These are #9, #12, #13 and the Dependabot PRs. → Mitigation: both rulesets require branches to be up to date (`strict: true`, verified). Such a PR can't merge until it is updated with `dev`. After the update, its diff against the base shows the changes at their `apps/` paths (Git follows the renames), and CI runs with the right selection. No legacy prefixes are kept in the filter.
- **[Risk] The API rate limit or an outage fails `changes`.** → Mitigation: fail-open (D3) runs everything.
- **[Trade-off] Docs-only PRs show two skipped checks** instead of two green ones, which is less obviously "passed". The PR template and docs mention it.
- **[Trade-off] Stacked PRs lose CI** until they target `dev`.

## Migration Plan

1. In one commit, add `ci.yml` and delete `api.yml` and `frontend.yml`. In the PR that carries it, GitHub runs the workflows from the PR's merge ref, so the new workflow already reports both required names.
2. Verify on the real PR and on throwaway PRs into `dev`, closed without merging:
   - docs-only: both skipped, mergeable;
   - API-only: only "Test and static checks" runs;
   - web-only: only "Type-check, lint, build" runs;
   - `ci.yml` edit: both run.
3. A PR into `main` still triggers CI. Check it with the next release PR, or with a throwaway PR into `main` that is closed.
4. **Rollback:** revert the commit. The old workflows come back with the same job names.

## Open Questions

None.
