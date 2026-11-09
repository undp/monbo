## 1. Baseline

- [x] 1.1 Record the open alert list (`gh api repos/undp/monbo/dependabot/alerts?state=open --paginate`) as the starting point. It had 147 alerts on 2026-11-09, #121–#274: 21 critical, 82 high, 43 medium and 1 low. Note the per-fix counts: web 11 + 1, API 85, tools 50
- [x] 1.2 Q2: confirm with the user whether the dev environment is publicly reachable, to set the urgency of section 2
  - Yes: anyone with the link can open it, with no VPN, IP allowlist or login. So the Next.js RCEs were exposed to the internet until #98 merged. The app uses neither `use cache` nor SVG in image optimization, which both advisories require

## 2. Web: Next.js and undici through #98 (D1)

- [x] 2.1 Comment `@dependabot rebase` on #98 (ask first). Wait for the rebase and CI
  - Dependabot rebased #98 on its own (c415b06, 2026-11-09 15:01) after #99. No comment was needed. It is `MERGEABLE`/`CLEAN`, and `Tests, type-check, lint, build` is green
- [x] 2.2 On the rebased branch:
  - `pnpm why next` and `pnpm why undici` show only `next` ≥ 16.4.1 and `undici` ≥ 8.12.2;
  - `package.json` keeps the four dependencies added by #99
  - The lockfile has only `next@16.4.5` and `undici@8.12.4`. The `package.json` diff against `dev` changes only versions; the four dependencies from #99 remain
- [x] 2.3 If the rebase or CI fails, apply D1's fallback: `@dependabot recreate` first, then our own PR with `next`/`eslint-config-next` 16.4.x and an `undici` refresh
  - Not needed: the rebase succeeded and CI is green
- [x] 2.4 Merge #98 once CI is green (ask first). Check that the `dev` deploy succeeds, then do a manual pass on the deployed site: upload the regression farms file, run the analysis, download the report (R1)
  - Squash-merged as bc89270 with the user's confirmation. The `dev` deploy succeeded, and the 11 `next` and `undici` alerts closed on their own (147 → 136). The user then did the manual pass on the deployed site: the upload, analysis and report download all work

## 3. API: one PR for its alerts (D2, D3)

- [x] 3.1 Branch from `origin/dev`. In `apps/api/pyproject.toml`, set `pillow==13.0.0` and `black==26.10.1`. Then run `uv lock --upgrade-package pillow --upgrade-package black --upgrade-package certifi --upgrade-package dnspython`
  - uv moved `certifi` to 2026.10.23 and `dnspython` to 2.9.2, the latest patched versions
- [x] 3.2 Review the `uv.lock` diff: only `pillow`, `black`, `certifi` and `dnspython` move (plus anything they require, explained in the PR)
  - Only those four `version` lines change
- [x] 3.3 Run pytest (with `test_numeric_baseline`, without touching `tests/numeric_baseline/`), ruff, `black --check`, mypy and `app.openapi --check`
  - With Pillow 13: 482 passed (the 8 numeric baseline tests included, with `tests/numeric_baseline/` untouched); ruff, black, mypy and `app.openapi --check` pass. Pillow 13 deprecates `Image.getdata()` (removal in Pillow 14), and one test used it: `test_helpers.py::test_get_tile` now uses `get_flattened_data()`. The `Error in sys.excepthook` lines after the run also appear on `dev` with Pillow 12; they are not new
- [x] 3.4 D3 spot check: generate a deforestation image for a regression farm before and after the upgrade. It opens with the same size and no visible difference
  - `/generate-image` without the satellite background, on the regression fixture layers, for F01, F02, F04 (point) and F08 on layers 0 and 1. The 8 JPEGs are byte-identical under Pillow 12.3.0 and 13.0.0. The satellite path (Google Static Maps) wasn't run. Pillow 13 has cp313 `manylinux_2_28` x86_64 and aarch64 wheels, so `uv sync --no-build` in `python:3.13-slim` still installs a wheel
- [x] 3.5 `CHANGELOG.md` → Unreleased → Security: Next.js 16.4.5 (#98), Pillow 13, certifi, dnspython, black, the gfw-tmf lock refresh, and the `minimatch` dismissal
  - Everything except the `minimatch` dismissal, which changes nothing in the product
- [x] 3.6 Commit and open a PR into `dev` (ask first). The description:
  - lists the alerts it closes;
  - names #84 and #91 as superseded;
  - states that none of Pillow 13's breaking changes apply to the API's calls (the `python-dependency-toolchain` requirement)
  - #100, rebased onto bc89270. CI green (`Test and static checks`, CodeQL)
- [x] 3.7 After the merge: close #84 and #91 with a comment naming the PR (ask first). Check that the `dev` deploy succeeds
  - #100 was squash-merged as 9ff06f1, and its `dev` deploy succeeded. Dependabot closed #91 ("dnspython is up-to-date now") and #84 on its own, so no comment was needed

## 4. GFW/TMF script: lockfile refresh (D4)

- [x] 4.1 Branch from `origin/dev`. In `tools/update-gfw-tmf`, run `uv lock --upgrade-package` for `pillow`, `certifi`, `pyasn1`, `tornado` and `msgpack`
  - Worktree branch `BlancaMunizaga/gfw-tmf-security-lock`: `certifi` 2026.10.23, `msgpack` 1.2.4, `pillow` 13.0.0, `pyasn1` 0.6.5, `tornado` 6.6
- [x] 4.2 Run `uv lock --check`. Review the diff: only those packages move (plus what they require), and `pyproject.toml` is unchanged
  - `uv lock --check` passes. Only those five `version` lines change; the rest of the diff is their new wheel entries
- [x] 4.3 Commit and open a PR into `dev` (ask first). It names #83, #89, #90, #92 and #93 as superseded, and recommends a bounded run of the script to the next operator
  - #101, rebased onto bc89270. CI has nothing to run for `tools/` (only `Detect changes` and CodeQL, both green)
- [x] 4.4 After the merge, close the five superseded PRs with a comment naming the PR (ask first)
  - #101 was updated with `dev` after #100 merged, CI ran again, and it was squash-merged as 86c98b4. Dependabot closed #83, #89, #90, #92 and #93 on its own ("… is up-to-date now")

## 5. Remaining alerts

- [x] 5.1 Re-list the open alerts after sections 2–4. Each one still open has a reason
  - After #100 and #101: 0 open. Every alert closed on its own except `minimatch` (5.2)
- [x] 5.2 Dismiss `minimatch` as `tolerable_risk`, with D5's comment (ask first)
  - Alert #274 was dismissed as `tolerable_risk` on 2026-11-09, with the user's confirmation and D5's comment
- [ ] 5.3 Q1: look at the Dependabot job log for `apps/api` to see why it didn't open a `certifi` PR. Record the finding here, and open an issue if the failure recurs
  - Not investigated. The job log is only in GitHub's UI (Insights → Dependency graph → Dependabot), not in the API. It didn't block anything, because #100 fixed `certifi` by hand. Archived open: check it if a security update goes missing again
- [x] 5.4 Check #96: it has rebased without `black`, or comment `@dependabot rebase` (ask first). Its review stays out of this change
  - Dependabot closed #96 ("updatable in another way") and reopened its other six bumps, without `black`, as #102

## 6. Close-out

- [x] 6.1 Run `openspec validate security-alerts-2026-11`
- [x] 6.2 Record here the final alert count (expected: 0 open) and the merge commit of each PR
  - 0 open. Of the 147: 146 fixed by the merges, and 1 dismissed (`minimatch`, #274)
  - Merges: #98 bc89270, #100 9ff06f1, #101 86c98b4

## 7. Version updates (outside the alerts, triaged in the same pass with the user's confirmation)

- [x] 7.1 Merge the Dependabot PRs that fixed no alert, one at a time. Each was updated with `dev`, then CI ran, then it merged
  - #77 (`setup-uv` 10.3.3, `setup-node` 7.1.0): a3e75b6. The full CI was green
  - #73 (`earthengine-api` 1.7.51, `tenacity` 9.2.1, with three Google client libraries `earthengine-api` requires): f8c8c5a. `uv lock --check` passes; nothing runs the script in CI
  - #69 (`concurrently` 10.0.6): ac6605d. A commit on the PR removed the root's `concurrently>shell-quote` override, because 10.0.6 depends on `shell-quote` 1.12.0, which meets the README's exit condition. The README note was removed and the CHANGELOG line adjusted. `pnpm install --frozen-lockfile` and `concurrently` work
  - #81 (`azurerm` 5.12.0, both stacks): c7ae23a. The `dev` deploy applied the `apps` stack with the new provider: 2 in-place changes, the two container images, and nothing else. The `platform` stack picks it up at its next manual apply
  - #102 (FastAPI 0.162.0, shapely 2.2.0, azure-storage-file-share, pytest, ruff, mypy; it replaced #96): 704ea1d, after a review:
    - the regression farms results match to 1e-9 and the numeric baseline passes untouched;
    - the 8 spot-check images are byte-identical;
    - `openapi --check` passes and 482 tests pass;
    - `fastapi[standard]` now brings `httpx2`, `httpcore2`, `httpx2-jsfetch` and `truststore`. The app's outbound calls still use `httpx`, and all four ship pure-Python wheels.
    The `dev` deploy succeeded
- [ ] 7.2 Follow-up: shapely 2.2 deprecates `shapely.ops.transform()`, used in `app/utils/image_generation/GeometryHelper.py` and in two tests of `test_helpers.py`. Move them to `shapely.transform()` before shapely 3
