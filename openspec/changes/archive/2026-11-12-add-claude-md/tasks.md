## 1. Collect and verify the facts

- [x] 1.1 Verify each bullet of `.claude/skills/pr-review/SKILL.md` "Project Context" and "0. Project Conventions" against the code (`apps/api/app/`, `apps/web/src/`, `apps/web/entrypoint.sh`, `infra/terraform/apps/web.tf`, `apps/api/app/maps/index.json`). Keep the ones that hold; correct or drop the rest (design D3, D4)
- [x] 1.2 Read the commands from the root `package.json`, both app `package.json` files and `.github/workflows/ci.yml`, so `## Commands` lists exactly what CI runs per app
- [x] 1.3 Collect the testing facts. API tests live under `apps/api/tests/` (`modules/`, `regression/`, `numeric_baseline/`, `test_numeric_baseline.py`, `test_openapi.py`). Web tests are colocated as `src/**/*.test.ts(x)`, with helpers in `src/test/` and the locale parity test in `src/locales/locales.test.ts`. Include how to run one file in each app
- [x] 1.4 Collect the security facts. Admin login, session and origin come from `docs/architecture.md` "Logging in and the session" and `app/modules/admin/auth.py`. Secrets come from `app/config/env.py` and the `.env*.example` files. Also check LFS (`.gitattributes`), actions pinned by SHA and exact dependency pins

## 2. Write the files

- [x] 2.1 Write `CLAUDE.md` at the root with the outline in design D1 and the invariants in D2: English, 200 lines at most, a link wherever a doc owns the detail
- [x] 2.2 In `## Workflow` state the same-PR rule (design D6), the `dev`/`main` flow with a link to `docs/branch_protection.md`, OpenSpec under `openspec/`, the two required CI job names, and English for code, commits, PRs and OpenSpec
- [x] 2.3 In `## Domain skills` add a table of the skills in `.claude/skills/` (`openspec-*`, `pr-review`, `pr-comment-triage`) with when to use each
- [x] 2.4 In `.claude/skills/pr-review/SKILL.md` replace "Project Context" and "0. Project Conventions" with a pointer to `CLAUDE.md`. Keep the stakes sentence and the review-only items, and extend the repo-wide "documented behavior" check to name `CLAUDE.md` (design D3, D6)
- [x] 2.5 Add one line to `docs/onboarding.md` §4.5 (suggested reading order) that points to `CLAUDE.md` for the conventions

## 3. Check

- [x] 3.1 Check that every repository path in `CLAUDE.md` exists, for example by extracting the backticked paths and running `test -e` on each
- [x] 3.2 Run each command listed in `## Commands` once, or confirm it matches its line in `package.json` / `ci.yml` when it needs services or secrets
- [x] 3.3 `wc -l CLAUDE.md` reports 200 or fewer
- [x] 3.4 `grep -rn "no authentication" .claude/ CLAUDE.md` finds only statements scoped to the public routes; no file claims the API as a whole has no authentication
- [x] 3.5 Start a fresh agent session at the root and ask where the API conventions are, what `value: null` means and how to regenerate the contract types. The answers must come from `CLAUDE.md`

Suggested commit grouping (for the user to decide): one commit for `CLAUDE.md` plus the `docs/onboarding.md` line, and one for the `pr-review` pointer.
