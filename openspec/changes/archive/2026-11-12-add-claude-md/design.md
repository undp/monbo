## Context

Repository knowledge lives in four places today:

| Source | Lines | Holds | State |
|---|---|---|---|
| `docs/onboarding.md` | 329 | product, end-to-end flow, setup, gotchas, reading order | current; states that behavior changes update it in the same change |
| `docs/architecture.md` | 502 | Azure resources, layer reads, admin login and session | current |
| `apps/api/README.md`, `apps/web/README.md` | 354, 410 | per-app commands, testing | current |
| `.claude/skills/pr-review/SKILL.md` §"Project Context", §0 | ~80 | the conventions list a review checks | mostly current; says "no authentication", which `admin-authentication` made false |

There is also a personal `monbo-kevin-review` skill outside the repo. It distills a reviewer's
habits, but it uses the old `monbo-api/` / `monbo-front/` paths, says the contract is kept by hand
and names the old CI job. It may be used as a checklist of topics, never as a source of facts.

## Goals / Non-Goals

**Goals:**
- One file at the root that gives any session the rules a contributor would otherwise learn
  from review comments, verified against the code at merge time.
- One home for the code conventions, so `pr-review` and future skills stop keeping copies that
  drift.
- Stable English headings that tools can address.

**Non-Goals:**
- Rewriting or moving content out of `docs/`. `CLAUDE.md` links; the docs own the detail.
- An `AGENTS.md`, nested `CLAUDE.md` files per app, or `.cursor` rules. One root file covers a two-app
  repo of this size. Nested files can come later if a section outgrows the budget.
- Committing the personal `monbo-kevin-review` skill.
- Any CI check of `CLAUDE.md`'s contents. The length budget and path checks are verified in review
  (tasks 3.x).

## Decisions

### D1. Outline and budget
```
# Monbo                — 3–5 lines: what it is (EUDR deforestation and due diligence), read first:
                         docs/onboarding.md, docs/architecture.md
## System map          — apps/api, apps/web, tools/update-gfw-tmf, tools/layers-ops, infra/,
                         openspec/, docs/; the invariants (below)
## Commands            — root pnpm dev|test|lint|build|contracts; the per-app commands CI runs
## Code conventions    — ### API, ### Web, ### Map layers, ### Repo-wide
## Security            — secrets, public routes vs /admin, LFS, pinned actions and deps
## Testing             — where tests live, how to run one, numeric baseline, regression suite
## Workflow            — dev/main flow, OpenSpec changes, required CI job names, English artifacts
## Domain skills       — table of .claude/skills/* and when to load each
```
Budget: 200 lines. Claude Code loads the file into every session, so each line costs context
on every turn. Bullets of one or two lines, each ending in a link when detail exists elsewhere.
*Alternative:* a long file that inlines the docs. Rejected because it duplicates content and
would drift.

### D2. Invariants that belong in the System map
These hold across modules and are what reviews most often catch:
- The public flow is stateless: no database, and session state lives in the browser's
  `DataContext`, so a refresh drops the flow by design.
- Per-farm or per-map failures return `value: null` (area `-1`), meaning "could not be
  computed". A sentinel must never leak into arithmetic or a report.
- `analize` is the contract spelling (`/deforestation_analysis/analize`, `AnalizeBody`).
- Rasters are Git LFS files catalogued in `apps/api/app/maps/index.json`. Without `git lfs pull`,
  module 2 fails.
- The PDF is built in the browser; the API only produces images and tiles.
- The `/admin` API is opt-in (`ADMIN_SESSION_SECRET` plus the per-country layout), using passkey
  login and HMAC-signed sessions. Link to `docs/architecture.md` "How the per-country admin
  works".
- The deforestation ratio uses `min(1.0, …)` with `all_touched=True` and the geodesic area. Link
  to `docs/deforestation_calculation.md` and `docs/polygon_area_calculation.md`.

### D3. Conventions come from pr-review §0, verified, then pr-review points back
`pr-review` §0 is the most complete and most recent list, so start from it. Verify each bullet
against the code (task 1.x) and move it to `## Code conventions` / `## Security` / `## Testing`.
Then replace §0 and "Project Context" in the skill with: "Read `CLAUDE.md` (`## System map`,
`## Code conventions`, `## Security`, `## Testing`) and the docs it links for the touched area."
Keep in the skill the review-only parts: the stakes sentence ("a silently wrong deforestation
ratio is worse than a crash") and the advisory constraint.
*Alternative:* leave `pr-review` untouched. Rejected because two copies drift, as the stale
"no authentication" claim already shows.

### D4. Fix known drift while moving
- "No authentication" → public routes are unauthenticated with open CORS (no credentials);
  `/admin` requires a per-country bearer token, and `ADMIN_ALLOWED_ORIGIN` restricts its origin.
- Version: four files must match (root `package.json`, `apps/api/package.json`,
  `apps/web/package.json`, `apps/api/pyproject.toml`), plus a `CHANGELOG.md` entry on release.
- CI job names: `Test and static checks` (API) and `Tests, type-check, lint, build` (web). They
  are required checks, so renaming one needs the ruleset steps in `docs/branch_protection.md`.

### D5. Headings are an addressable interface
`## Code conventions`, `## Security`, `## Testing` and `## Domain skills` are exact headings that
skills and tools can look up. Renaming one is a change to that interface, so it updates its
readers (today `pr-review`) in the same PR.

### D6. Staying current
`CLAUDE.md` adopts `docs/onboarding.md`'s rule: a change that alters something `CLAUDE.md`
states updates it in the same PR. `## Workflow` says so in one line. `pr-review`'s existing
repo-wide check ("a PR that changes documented behavior without updating it is a finding") is
extended to name `CLAUDE.md`.

## Risks / Trade-offs

- [`CLAUDE.md` drifts like pr-review §0 did] → D6's same-PR rule, enforced by `pr-review`, and one
  copy instead of two.
- [200 lines can't hold everything] → It holds rules and pointers. The detail stays in `docs/`.
  If a section outgrows the budget, the follow-up is a nested `apps/<app>/CLAUDE.md`, not a longer
  root file.
- [A wrong fact in an always-loaded file misleads every session] → Task 3.1 checks every path
  and command at merge time, and the facts come from code, not from older notes.
- [The repo is public and UNDP-owned] → The file contains only repository knowledge, the same
  kind as `docs/`, with no internal or personal content.

## Migration Plan

Docs-only. Merge to `dev` like any change. Rollback is reverting the PR, which restores
`pr-review` §0 with it.

## Open Questions

None.
