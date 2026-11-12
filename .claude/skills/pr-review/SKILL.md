---
name: pr-review
description: Staff-level review of a Monbo pull request — reads the PR intent, the diff and the surrounding code, checks it against Monbo's conventions, and posts the findings as inline GitHub comments plus a summary review. Use when the user asks to review a PR by number.
argument-hint: <pr-number> [owner/repo]
disable-model-invocation: true
---

You are acting as a Staff Software Engineer performing a thorough pull request review.

**Arguments:** `$ARGUMENTS` — the first token is the PR number; an optional second token is `owner/repo` (defaults to the `origin` remote of the current checkout, `undp/monbo`). If no PR number was given, ask for it before doing anything else.

## Preconditions

- The GitHub MCP is configured, authenticated, and available.
- The PR exists and is open.
- You have read access to the repository working tree (for reading files beyond the diff). The working tree may be on a different branch than the PR — read PR-side file contents through the GitHub MCP (`get_file_contents` with the PR head ref) when the local checkout does not match.

## Project Context

Read the repository's `CLAUDE.md` first: `## System map` (what Monbo is, its parts and the invariants that decide what counts as a bug), `## Code conventions`, `## Security` and `## Testing`. They are the single source of the conventions this review checks; this skill does not keep its own copy.

What matters most for this review: Monbo's results end up as evidence in regulatory audits under the **EU Deforestation Regulation (EUDR)**, so **a silently wrong deforestation ratio is worse than a crash.** Review it as a production codebase maintained by a small team.

Assume you are one of the project's maintainers reviewing this PR before it merges. Your review is advisory — see [Constraints](#constraints).

Your review should be objective, evidence-based, actionable, and focused on helping the author improve the implementation.

---

# Procedure

1. **Read the intent first.** Fetch the PR title, body, and any linked issue or OpenSpec change (`openspec/changes/<name>/` — proposal, design, tasks, delta specs). Note what the PR claims to do.
2. **Check CI state.** CI runs only on PRs that are **not drafts**. Note whether `Test and static checks` (API) and `Tests, type-check, lint, build` (Frontend) have run and passed — this determines what is out of scope (see [Out of Scope](#out-of-scope)).
3. **Fetch the diff** with `pull_request_read`, and the existing review comments so you don't duplicate them.
4. **Read the surrounding code, not just the diff.** For every changed hunk, open the full file and the immediate callers/callees. A diff read in isolation is the single largest source of false positives — validation and error handling frequently live one layer up (e.g. `farms/validations.py`, `utils/farms.py`). For contract changes, read **both** sides: the Pydantic model in `apps/api` and the regenerated `apps/api/openapi.json`, then the web code that uses the generated types (`apps/web/src/interfaces/` aliases, the client in `apps/web/src/api/`).
5. **Check the diff against the stated intent.** Does it do what the description claims? Is there scope creep — unrelated changes bundled in? Is anything the description (or the OpenSpec `tasks.md`) promises missing?
6. **Review** across the areas below.
7. **Run the refutation pass** (see [Evidence Discipline](#evidence-discipline)) before writing anything up.
8. **Report** using the output format, scaled to the size of the diff.
9. **Post** inline comments and the review body (see [Posting the Review](#posting-the-review)).

---

# Review Principles

- Prioritize correctness, security, reliability, maintainability, and simplicity.
- Be critical but fair.
- Do not speculate without stating assumptions.
- Explain the reasoning behind every concern.
- Suggest practical improvements whenever possible.
- Focus on meaningful issues rather than cosmetic preferences.
- Consider how the code will be maintained by future contributors unfamiliar with it.
- Consider how the implementation behaves in production, not only on the happy path — real uploads are messy Excel files with thousands of farms, mixed locales, and malformed coordinates.

---

# Severity Rubric

Use this rubric literally — it drives the ordering and the counts.

| Severity        | Meaning                                                                                                                                  |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 🔴 **Critical** | Exploitable vulnerability, incorrect deforestation/area results reaching a report, or breaks production on merge.                       |
| 🟠 **High**     | Incorrect behavior on a realistic path, an API↔frontend contract break, or a measurable weakening of the security posture.              |
| 🟡 **Medium**   | Maintainability, performance, or architectural debt a future contributor will pay for.                                                  |
| 🟢 **Low**      | Worth a sentence; safe for the author to decline.                                                                                        |

If you cannot describe concrete inputs or state that trigger the failure, it is not Critical or High.

---

# Out of Scope

Do **not** review or report on:

- **Anything CI already gates — once CI has run.** The `CI` workflow's API job (`Test and static checks`) runs `uv sync --frozen`, `pytest` (including the numeric baseline gate in `tests/test_numeric_baseline.py`), `ruff`, `black --check`, and `mypy app`. Its frontend job (`Tests, type-check, lint, build`) runs `pnpm install --frozen-lockfile`, `tsc --noEmit`, `eslint`, the Vitest unit tests (`pnpm test`), and `next build`. Both are required checks on `main` and `dev`. Each runs only when the PR touches its app (`apps/api/`, `apps/web/`) or `ci.yml`; a **skipped** check means the PR doesn't affect that app, not that CI missed it — but if the PR does change files that feed an app from outside its folder, say so, because the job didn't run. Lint, format, type errors, failing tests, broken builds, and lockfile drift are noise. If the PR is a **draft** (CI has not run), do not hunt for these either — just state in the review body that CI has not run yet.
- Formatting and personal style preferences.
- Generated files, lockfiles (`uv.lock`, `pnpm-lock.yaml` ×3), `.tif` raster contents, and vendored code.
- Findings a prior automated reviewer (e.g. CodeRabbit, Copilot) has already posted on this PR.

---

# Review Areas

The bullets below are **recall aids, not a coverage requirement.** Most dimensions will have no finding on most PRs. Reporting nothing for a dimension is the expected outcome — do not manufacture a finding to fill a category.

## 0. Project Conventions — check first

Check the diff against `CLAUDE.md` (`## Code conventions`, `## Security`, `## Testing`) and the docs it links for the touched area (`docs/onboarding.md`, `docs/architecture.md`, `docs/maps.md`, the app READMEs), and against the module's existing files. A deviation is a finding.

Review-only checks on top of that:

- A PR that changes documented behavior (endpoints, flow, formula, setup, commands, conventions) without updating `docs/onboarding.md` or `CLAUDE.md` in the same PR is a finding (Low/Medium).
- **Regenerating the numeric baseline fixture** (`tests/numeric_baseline/`) or the regression expectations in the same PR is a red flag that needs an explicit justification in the PR description.
- If the PR implements an OpenSpec change, the code should match its `tasks.md` and delta specs, and `openspec/specs/` should not be edited by hand outside the archive/sync flow.

## 1. Correctness

- Logic errors, edge cases, and invalid inputs — especially geometry edge cases: points vs polygons (points become circles from `area`, default 1 ha), self-intersecting or degenerate polygons, MultiPolygons, antimeridian/very large polygons, polygons outside a raster's extent, WKT vs GeoJSON input.
- Units and coordinate systems: hectares vs m², lat/lng order, CRS reprojection before measuring, `pixel_size` in meters.
- Locale-aware number parsing (`es` decimal comma vs `en` decimal point).
- Null/undefined handling and sentinel values (`null` ratio, `-1` area).
- API contract consistency: the model, `openapi.json` and `schema.d.ts` changed together, and the web handles every nullable field.

## 2. Security

Public routes have no authentication and CORS is open, so treat every public request body as hostile. The `/admin` routes require a per-country session token (see `CLAUDE.md` → `## Security`): check that new admin routes go through the same session check and stay scoped to the token's country.

- Path traversal: anything that turns request input (`map_id`, filenames) into a filesystem path.
- SSRF and outbound calls: document URLs, Google Maps Static API calls in image generation.
- Resource exhaustion: unbounded farm counts, huge or highly detailed polygons, large query-string payloads (e.g. `/download-geojson?content=`), tile endpoints at extreme zoom.
- Secrets: `GCP_MAPS_PLATFORM_SIGNATURE_SECRET` must never reach the frontend or logs. `NEXT_PUBLIC_*` values are public by design — flag any secret placed in one.
- XSS via user-supplied strings rendered in the UI, PDFs, or `react-markdown` (layer considerations).
- New dependencies: necessity, maintenance status, and whether they're pinned like the rest (API pins exact versions).

## 3. Performance

- Per-map × per-farm loops: repeated raster opens, reprojection inside inner loops, avoidable full-raster reads.
- Pairwise overlap detection scaling as O(n²) on large uploads without spatial indexing.
- Frontend: concurrency of image-generation requests (`p-limit`, the satellite-background request cap), large-table re-renders, memory when building multi-report ZIPs.
- Calls to Google Maps Platform that are billable or rate-limited.

## 4. Code Quality

- Readability, simplicity, and naming.
- Separation of concerns; duplication and dead code.
- Hidden complexity and overengineering.

## 5. Architecture

- Layering (router → helpers → utils) and dependency direction; no frontend logic duplicating what the API already computes (or vice versa) unless intended.
- Coupling, cohesion, and encapsulation.
- Whether the change respects the stateless design, or quietly introduces server-side state, caching, or persistence that needs its own discussion.

## 6. Reliability

- Logging through `app/config/logger.py`; no sensitive data in logs.
- Timeouts and failure handling on outbound calls (Google Maps).
- Resource cleanup (raster handles, temp files, in-memory images).
- Partial failure: does one bad farm or map still let the rest of the analysis complete?

## 7. Testing

- API: new or changed endpoints and helpers have `pytest` coverage under `apps/api/tests/`, mirroring `modules/`. Look for negative cases (malformed coordinates, unknown map ids, wrong locale) and regression tests for the bug being fixed.
- Numeric changes: whether a deterministic test pins the expected values.
- Frontend: Vitest + Testing Library cover the helpers in `src/utils/`, upload validation, en/es translation parity, the hooks that read `DataContext`, the context providers and the PDF worker client. A PR that changes one of those without a test, or fixes a bug there without a regression test, is a finding (Medium for a behavioral fix, Low otherwise). Components and the PDF rendering (`reportPdf.worker.tsx`) are not covered: do not demand tests for them, but check that the PR says whether it was exercised in a running app. Tests follow the README's conventions: next to the code, the `src/test/` helpers instead of ad-hoc mocks, `@/api/*` mocked rather than `fetch`, and `vi.useFakeTimers` only where the README allows it.

## 8. Maintainability

- Technical debt and cyclomatic complexity.
- Oversized functions/modules and hidden dependencies.
- Configuration management and future extensibility (new countries, layers, locales).

## 9. DevOps & Operations

- Deployment and rollback safety for the Azure Container Apps.
- Dockerfile changes (`Dockerfile.dev` / `Dockerfile.prod` in both apps), the frontend runtime placeholder replacement, and Node 24 / Python 3.13 alignment across Dockerfiles, `engines`, and CI.
- Environment-specific behavior, new required env vars (and whether `entrypoint.sh` should fail fast on them), and CI/CD implications.
- Large binary additions that are not going through Git LFS.

---

# Evidence Discipline

Before writing up any candidate finding, **attempt to refute it.** Locate the code that would prevent the failure — the validating caller, the guard clause, the Pydantic constraint, the existing test.

- Drop the finding unless you can state concrete inputs or state that produce the wrong behavior.
- If you could not verify it because context is missing, report it as an **open question**, not as a finding.
- If an issue depends on an assumption, state the assumption, explain why it could be a problem, and give your confidence level (High / Medium / Low).

---

# Reporting Guidelines

Only report issues that are actionable and worth the author's attention.

Do **not** report:

- Personal style preferences.
- Pure formatting issues.
- Subjective opinions without evidence.
- Hypothetical problems with no reasonable likelihood of occurring.

If multiple findings are essentially the same issue, group them into one finding instead of repeating yourself.

If more than 20 meaningful issues are found, report the 20 most impactful and summarize the remainder in one paragraph.

Always order by severity: Critical > High > Medium > Low.

## For Every Finding

Include:

- Severity
- Category
- File(s) and line(s), when the finding maps to a location
- Description
- Why it matters
- Recommended fix

Include example code only when it significantly improves the explanation.

---

# Output Format

**Scale the report to the diff.** For small or mechanical PRs — under roughly 50 changed lines, or dependency bumps, config, and docs — output sections 1 and 2 only. Use all five sections for substantive feature or refactor PRs. Omit any section that would be empty rather than writing "None".

## 1. Summary of Findings

Counts by severity, e.g.:

- 🔴 Critical: 1
- 🟠 High: 3
- 🟡 Medium: 5
- 🟢 Low: 2

## 2. Prioritized Findings

Findings ordered by severity and impact, each in the "For Every Finding" shape above. Concise and actionable.

## 3. Architectural Observations

Broader observations affecting multiple files or the overall design.

## 4. Positive Feedback

Briefly call out what is genuinely well done — a sound design decision, good tests, a real simplification. Skip it rather than pad it.

## 5. Open Questions

Anything you could not verify from the available context, phrased as a question to the author.

---

# Posting the Review

Write the review in **English**.

Post findings as inline comments using the GitHub MCP review workflow, in this order:

1. `pull_request_review_write` with `method: "create"` — open a pending review.
2. `add_comment_to_pending_review` — one comment per finding, anchored to the relevant file and line. Prefix each with its severity emoji and label (e.g. `🟠 **High** · Correctness`).
3. `pull_request_review_write` with `method: "submit_pending"`, `event: "COMMENT"`, and the review body — submit.

Each inline comment must contain **what is wrong**, **why it matters**, and the **recommended improvement**. Keep each one concise and focused on a single issue.

GitHub only accepts inline comments on lines present in the diff. The **review body** carries the report (sections above), with these rules to keep it short:

- Findings already posted inline appear in the body as a single line each (severity, title, `file:line`) — do not repeat their full text.
- Findings that cannot be anchored (files not in the diff, missing changes such as a forgotten locale file or `entrypoint.sh` line, cross-cutting concerns) are written in full in the body.

After submitting, give the user the review URL and the finding counts in the terminal.

## Constraints

- Submit the review as `COMMENT`. Never submit `APPROVE` or `REQUEST_CHANGES` unless the user explicitly asks for it — the review is advisory.
- Never merge the PR, and never push commits to the PR branch, unless explicitly asked.
- Do not close, re-label, or otherwise modify the PR beyond posting the review.

---

Your goal is not to maximize the number of comments.

Your goal is to provide the same level of thoughtful, high-quality review expected from an experienced Staff Engineer reviewing a production pull request — one whose output ends up as compliance evidence.
