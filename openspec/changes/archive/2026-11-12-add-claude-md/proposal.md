## Why

Monbo has no `CLAUDE.md`. An agent session starts knowing nothing about the repo. It doesn't know that `analize` is a contract spelling, that `value: null` means "could not be computed", or that the API's Pydantic models generate the web's types and CI fails when those are stale. It doesn't know that a new `NEXT_PUBLIC_*` variable needs four coordinated edits, or that regenerating the numeric baseline to make CI green is itself the bug. Today that knowledge is spread over `docs/onboarding.md`, `docs/architecture.md`, two app READMEs and section 0 of the `pr-review` skill, and some of it has drifted. `pr-review` still says the API has "no authentication", although `/admin` has had per-country passkeys and signed sessions since `admin-authentication`.

One short root file that states the rules and points to the docs that own each topic gives every session, and every new teammate, the same starting point. It also gives the conventions one home, so they stop drifting between copies.

## What Changes

- New root `CLAUDE.md` in English, about 200 lines at most. It holds repository knowledge only: what Monbo is and what to read first, a system map with the invariants, commands, code conventions, security, testing, workflow, and the domain skills shipped in `.claude/skills/`. It links to the docs that own each topic instead of copying them. It contains no personal preferences and nothing about any external agent tooling.
- Every fact in it is checked against the current code, CI and docs, not against older notes. The known drift is corrected: admin authentication exists, the contract types are generated and checked in CI, and the paths are `apps/api` and `apps/web`.
- The `pr-review` skill's "Project Context" and "0. Project Conventions" sections now point to `CLAUDE.md` as the source of the conventions. The skill keeps only what is specific to reviewing. The "no authentication" claim goes away with the move.
- `CLAUDE.md` follows the same rule as `docs/onboarding.md`: a change that alters a command, convention or invariant it states updates it in the same pull request.

## Capabilities

### New Capabilities

- `agent-guidance`: the root `CLAUDE.md`, covering what it must contain, how it relates to `docs/`, that it stays current, and that it is the single source of the code conventions the repo's skills check against.

### Modified Capabilities

(none)

## Impact

- **New file:** `CLAUDE.md` at the repository root.
- **`.claude/skills/pr-review/SKILL.md`:** "Project Context" and section 0 shrink to a pointer to `CLAUDE.md`, plus the review-only items.
- **Docs:** `docs/onboarding.md` gains one line in its reading list that points to `CLAUDE.md`. No other doc changes; `CLAUDE.md` links to them.
- **No code, CI or dependency changes.** CI's path filter routes no job for a root markdown file or `.claude/`, so the PR runs only `Detect changes`.
