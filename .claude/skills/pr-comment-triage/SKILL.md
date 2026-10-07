---
name: pr-comment-triage
description: Act as the author of a Monbo pull request — collect its open review comments (inline threads, review bodies, general comments), triage each one as Fix or Discard with evidence, apply the fixes as pushed commits, and reply to every thread. Use when the user asks to address, triage, or resolve review comments on a PR by number.
argument-hint: <pr-number> [owner/repo] [--resolve]
disable-model-invocation: true
---

You are acting as the author of a pull request, triaging and resolving its open review comments.

**Arguments:** `$ARGUMENTS` — the first token is the PR number; an optional `owner/repo` token (defaults to the `origin` remote of the current checkout, `undp/monbo`); an optional `--resolve` flag to resolve threads after replying (default: do not resolve). If no PR number was given, ask for it before doing anything else.

## Preconditions

- The GitHub MCP is configured, authenticated, and available.
- The PR exists and is open.
- `uv` and `pnpm` are installed, with Node 24 (see `docs/onboarding.md` §4.0).
- Git LFS is installed only if you need to run module 2 by hand against the real rasters. The `pytest` suite does not need it: it uses mocks and a committed fixture raster.

## Project Context

**Monbo** is a deforestation-analysis and due-diligence-report tool for EU Deforestation Regulation (EUDR) compliance. It is a monorepo of two independent apps with no workspace manager: `apps/api/` (Python 3.13, FastAPI, uv, pytest) and `apps/web/` (Next.js 16, React 19, TypeScript, MUI 7, i18next with `es`/`en`, pnpm, **no test suite**). The system is stateless: no database, no auth, all session state in the browser. Results end up in compliance reports, so a silently wrong deforestation or area value is the worst outcome.

The repository lives in the UNDP GitHub organization but is not yet run as a public open-source project.

**Conventions are documented in `.claude/skills/pr-review/SKILL.md` → "0. Project Conventions"** (the same rules reviewers check against) and in `docs/onboarding.md`. Read both before triaging. They are what a **Discard — conflicts with conventions** verdict cites.

Review comments may come from human maintainers or from automated reviewers (CodeRabbit, Copilot, the `/pr-review` skill). Both get the same treatment: evaluated on the merits, never accepted or dismissed because of who wrote them.

---

# Procedure

## Phase 1 — Setup

1. **Protected-branch gate.** Resolve the PR's head branch via `pull_request_read` (`method: "get"`). If it is `main`, `dev`, `master`, `release`, `prod`, or `staging`, **abort immediately** with a clear error — do not check out, commit, or push. Also abort if the PR comes from a fork you cannot push to.
2. **Clean-tree gate.** If the working tree has uncommitted changes, stop and ask the user. Do not stash: the stash stack is shared across worktrees and sessions.
3. Check out the head branch and pull the latest from `origin`. Other agents or the author may have pushed since the comments were written. If git refuses because the branch is already checked out in another worktree, stop and tell the user which worktree to run in.
4. Install dependencies for the areas the PR touches: `uv sync --frozen` in `apps/api/`, `pnpm install --frozen-lockfile` in `apps/web/`, and `pnpm install --frozen-lockfile` at the root if the orchestrator is involved.
5. Read the PR body, including any linked issue or OpenSpec change (`openspec/changes/<name>/`). Fixes must stay inside the PR's stated scope.

## Phase 2 — Collect open comments

6. Fetch review threads with `pull_request_read` (`method: "get_review_comments"`). Paginate with `perPage` + `after` until `PageInfo` reports no further pages — **do not stop at the first page.**
7. Also fetch general PR comments with `pull_request_read` (`method: "get_comments"`) and review bodies with `method: "get_reviews"`. Actionable findings are frequently raised there rather than inline. A `/pr-review` body lists inline findings as one-liners — those are the same items as the inline threads, so don't triage them twice, but **do** triage the findings written out in full in the body (missing files, cross-cutting concerns) and its Open Questions.
8. Keep only **open** items:
   - Threads with `isResolved: false`.
   - Skip `isOutdated: true` threads **unless** the underlying concern still holds against current `HEAD` — verify by reading the code, not by trusting the flag.
   - Skip any thread whose last reply is already yours and cites a commit SHA. This skill is re-runnable; never fix or re-reply to something already handled.
9. Fetch the current diff (`method: "get_diff"`) and the changed-file list so every comment can be judged against the code as it stands now.

## Phase 3 — Triage (do this for **all** comments before changing any code)

Evaluate each open comment independently and assign exactly one verdict. Do not start editing until the whole set is triaged — this prevents a half-applied series of fixes.

| Verdict                                  | Meaning                                                                                                                         | Action                            |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| **Fix**                                  | The concern is valid, in scope, and the code should change.                                                                     | Phase 4                           |
| **Discard — incorrect**                  | The premise is wrong: the behavior is already handled, guarded, or the reviewer misread the code.                               | Reply with evidence               |
| **Discard — out of scope**               | Valid observation, but unrelated to this PR's stated purpose or pre-existing on the PR's base branch.                                         | Reply + propose a follow-up issue |
| **Discard — conflicts with conventions** | The suggestion contradicts the documented conventions, `docs/onboarding.md`, or the linked OpenSpec spec.                       | Reply citing the convention       |
| **Discard — preference**                 | A style or taste call with no material effect on correctness, security, or maintainability.                                     | Reply, briefly                    |

### Evidence rule

Before assigning **Discard — incorrect**, open the relevant file and the surrounding callers and confirm the guard actually exists (e.g. in `farms/validations.py`, `utils/farms.py`, the Pydantic model). Before assigning **Fix**, confirm you can state the concrete inputs or state that produce the wrong behavior. An unverified verdict in either direction is worse than asking a clarifying question — if you genuinely cannot determine which applies, reply asking for clarification and leave the thread open.

Bias toward **Fix** when the comment concerns correctness of deforestation/area results, geometry or unit handling, security of the public unauthenticated API, the API↔frontend contract, or a documented project convention (both locales, env var plumbing, map-layer metadata). Bias toward **Discard** when it is speculative, cosmetic, or would expand the PR's scope.

Some comments are deliberately-designed behavior that reviewers often mistake for bugs. Discard them as **incorrect** (citing `docs/onboarding.md`) unless the PR itself changed that behavior: open CORS, no auth, state lost on refresh, the `analize` spelling, `value: null` / area `-1` for per-farm failures, `all_touched=True` over-counting at edges, and the `react-hooks/*` rules demoted to `warn` in `eslint.config.mjs`.

---

## Phase 4 — Apply fixes

Work through the **Fix** comments one at a time, in severity order (security and correctness first).

For each:

10. **Group or isolate.** One commit per comment. Group several comments into one commit only when they touch the same code and constitute one logical change — in that case every grouped thread gets a reply citing the same SHA.
11. Make the change. Stay strictly within the scope of the comment. Do not opportunistically refactor adjacent code. If the fix touches a cross-cutting convention, make the whole change: an API field rename updates the Pydantic model, runs `pnpm contracts` (committing `apps/api/openapi.json` and `apps/web/src/api/schema.d.ts`), and fixes what the web's `tsc --noEmit` reports; a new UI string goes in both `locales/es/` and `locales/en/`; a new `NEXT_PUBLIC_*` variable goes in `config/env.ts`, `entrypoint.sh`, the web app's `env` blocks in `infra/terraform/apps/web.tf`, and the `.env.*.example` files.
12. Run the gate for each app you touched — the same commands CI runs:
    - API (in `apps/api/`): `uv run black . && uv run ruff check . && uv run mypy app`
    - Frontend (in `apps/web/`): `pnpm exec tsc --noEmit && pnpm run lint`, plus `pnpm run build` if the fix touches config, routing, env handling, or server/client boundaries. ESLint warnings don't fail CI, but the fix must not add new ones.
13. Run the tests covering the touched area:
    - API: `uv run pytest tests/modules/<module>` for the module, and `uv run pytest tests/test_numeric_baseline.py` whenever the fix touches deforestation math, area calculation, reprojection, raster masking, or image generation.
    - If the fix changes API behavior that had no test, add or extend one under `apps/api/tests/`. A behavioral API fix without a regression test is incomplete.
    - Frontend: there is no test harness — do not set one up as part of a fix. Rely on the type-check, lint and build, and say plainly in the reply that the change was not exercised in a running app unless you actually did so (`pnpm dev` at the root).
14. Commit using Conventional Commits, scoped to the app (e.g. `fix(api): reject polygons with fewer than three vertices`, `fix(front): add missing es translation for overlap modal`).
15. **Push before replying.** A SHA that is not on `origin` is useless to the reviewer.
16. Capture the SHA with `git rev-parse HEAD` **after** the commit lands.

If a fix turns out to be larger than expected, stop. Don't apply it halfway; reply to the thread proposing it as a follow-up and explain your reasoning. Examples: a change to the deforestation formula or its numeric baseline, a breaking API contract change, new or changed raster layers, a dependency major bump, or a cross-cutting refactor.

---

## Phase 5 — Reply to every triaged thread

Reply with `add_reply_to_pull_request_comment`.

> **Gotcha:** `commentId` is the **numeric** comment ID — the number from the `#discussion_r...` anchor. It is _not_ the GraphQL thread node ID (`PRRT_...`) returned alongside the thread. Passing the node ID will fail.

For comments that were not inline (review bodies, general PR comments), reply with `add_issue_comment`, quoting enough of the original to make the reply self-contained.

Write replies in **English**.

### Reply format — fixed

```
Fixed in <sha>.

<1–3 sentences: what changed and why it addresses the concern.>
```

### Reply format — discarded

```
<Verdict, stated plainly.>

<Why — cite the file:line, the guard, the convention, or the spec that supports it.>

<If out of scope: the follow-up issue you propose, or a note that it is worth a separate PR.>
```

Discard replies must be respectful and specific. Cite evidence rather than asserting; a reviewer reading the reply should be able to verify it without asking a follow-up. Close disagreements by inviting pushback — you may be the one who is wrong.

17. If `--resolve` was passed, resolve each replied thread with `pull_request_review_write` (`method: "resolve_thread"`, `threadId` = the `PRRT_...` node ID). **Default is to leave threads open:** the reviewer normally resolves their own thread, and resolving it yourself hides the discussion before they have read your reply.

---

## Phase 6 — Final pass

18. Re-run the gate and tests from steps 12–13 on the final state for every app you touched. If anything fails, fix it, commit, and push before finishing.
19. Confirm every open comment collected in Phase 2 now has either a fix commit or a reply. Nothing may be left silently unaddressed.
20. Post a single summary comment on the PR, keeping each entry to one line:
    - Comments addressed, with SHA per fix.
    - Comments discarded, with a one-line rationale each.
    - Anything deferred to a follow-up.
    - Anything left open pending clarification from the reviewer.
21. Report the same summary to the user in the terminal, with the PR URL.

---

# Constraints

- **Never force-push, amend, or rebase** after replying with a SHA — it invalidates every SHA already posted in a reply.
- **Never merge the PR**, change its state, or dismiss a review.
- **Never resolve a thread** unless `--resolve` was passed.
- **Never commit directly to a protected branch** — the Phase 1 gate is mandatory.
- **Never regenerate the numeric baseline fixture** (`tests/numeric_baseline/`) to make a failing test pass. A baseline failure means the fix changed the numbers — stop and report it.
- **Never commit a `.tif` raster outside Git LFS**, and never hand-edit raster files.
- Never use `git stash`; never touch lockfiles except through `uv lock` / `pnpm install` when a fix legitimately changes dependencies.
- Do not widen the PR's scope. A comment that calls for work beyond it becomes a follow-up proposal, not a commit.
- Do not accept a suggestion you believe is wrong just because a reviewer made it. Reply with your reasoning and let the thread run.

---

Your goal is not to close every comment as quickly as possible.

Your goal is to leave the PR in a state where each reviewer can see, for every point they raised, either the exact commit that addressed it or a well-reasoned explanation of why it was not.
