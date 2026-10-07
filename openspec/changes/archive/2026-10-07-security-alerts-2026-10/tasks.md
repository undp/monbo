## 1. Baseline

- [x] 1.1 Branch from `origin/dev`. Record the open alert list (`gh api repos/undp/monbo/dependabot/alerts?state=open`) as the starting point: 30 alerts, #78–#108
- [x] 1.2 Save the `/farms/parse` response for the regression farms file (`apps/api/tests/regression/regression_farms.xlsx`), parsed by the current web (`xlsx` 0.18.5), and download both Excel results (validation and deforestation), to compare against after the change (R4)
  - Done with a script that runs the web's exact read path (`readExcel` options, `parseExcelData`, `loadTemplateHeaders`) under Node, on both regression files and both templates. The downloads are written by `exceljs`, which this change doesn't touch in the browser; the browser check is in 3.4

## 2. Lockfile refresh and overrides (D2)

- [x] 2.1 `apps/web`: update `brace-expansion`, `tmp`, `yaml`, `@babel/runtime`, `mdast-util-to-hast`, `source-map-js` and `@humanfs/node` at any depth, within their parents' ranges. Confirm with `pnpm why` that no vulnerable version remains, and review the lockfile diff for unrelated moves (R3)
- [x] 2.2 `apps/web`: add the `pnpm.overrides` entry `"exceljs>uuid": "^11.1.1"`, and check `pnpm why uuid`
- [x] 2.3 Root: add the `pnpm.overrides` entry `"concurrently>shell-quote": "^1.11.0"`, update the root lockfile, and check that `pnpm dev` still starts both apps through `concurrently`
- [x] 2.4 Document both overrides (reason and exit condition) in the README of their package: `apps/web/README.md` and the root `README.md`

## 3. SheetJS from its CDN (D1)

- [x] 3.1 `apps/web/package.json`: set `"xlsx": "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz"`, and run `pnpm install`. pnpm records no integrity for a remote tarball (accepted, D1 and R6)
- [x] 3.2 Run `pnpm install --frozen-lockfile` from a clean `node_modules` and a Docker build of `Dockerfile.prod`, to confirm installs fetch it in both
- [x] 3.3 Run `tsc --noEmit`, lint (same warnings as before) and build
- [x] 3.4 Manual check against the baseline (1.2):
  - upload the regression farms file: same farms, same parsed values (dates included);
  - download both Excel results: they open, with headers, merges and wrapped text
  - The script comparison gave identical data, headers and template headers; only real date cells lose 0.18.5's spurious 45 seconds. The user checked uploads and both downloads in the browser: all working
- [x] 3.5 `apps/web/README.md`: "Dependencies outside Dependabot's reach", covering `xlsx` from SheetJS's CDN (where to watch releases, how to bump and test, that its content isn't hash-verified, and how to vendor it instead) and the overrides from 2.4

## 4. Docs and pull request

- [x] 4.1 `CHANGELOG.md` (Unreleased → Security), and the root README's dependency section if it lists the Dependabot gaps
- [x] 4.2 Run `openspec validate security-alerts-2026-10`
- [x] 4.3 Commit and open a PR into `dev` (ask first). The description is generic, with no account names

## 5. After the merge

- [x] 5.1 Re-list the open alerts. For each one still open, dismiss it in GitHub with its reason and a comment naming the evidence (D3), after the user confirms. Record whether the `xlsx` alerts closed themselves (Q1)
  - After #63 merged (34f09d1), 29 of the 30 alerts closed on their own, the four `xlsx` ones included: the dependency graph reads a URL dependency's version (Q1: yes). No alert needed a dismissal. The 30th, #108 (`cryptography`), closed with #58 (6.2)
- [x] 5.2 Check that the `dev` deploy succeeded and that the deployed web parses the regression farms file
  - The `dev` deploy of #63 succeeded (34f09d1), and later the one of #59 (6fb46e4: `/health` OK, `/config` unchanged, 17 OpenAPI paths). The user uploaded the regression farms file on the deployed web: it works

## 6. Dependabot PRs (D4), each GitHub action after the user confirms

- [x] 6.1 Close #44, #52, #55 and #56 with a comment: the path moved in the monorepo, superseded by the current-path PR
  - Closed on 2026-10-07, each with a comment naming its replacement: #44 → #58, #52 → #60, #55 → #57, #56 → #59. Their Dependabot branches were deleted
- [x] 6.2 #58 (`cryptography` 50, `tools/update-gfw-tmf`): run `uv sync --frozen` locally on its branch, then merge it; check that alert #108 closes
  - `uv lock --check` passed on its branch (`uv sync` needs the operator's system GDAL). It was behind `dev`, so Dependabot rebased it (`@dependabot rebase`) instead of using an admin merge. Merged as d254b42; alert #108 is fixed, and 0 alerts are open
- [ ] 6.3 Triage #57, #59 and #60 (merge or close) and record the outcome here
  - #57 (`earthengine-api` 1.7.46, `geemap` 0.38.9): `uv lock --check` passed after a Dependabot rebase onto #58. Merged as a3118cf
  - #59 (FastAPI 0.142.2, rasterio 1.5.2, python-dotenv, azure-storage-file-share, ruff, mypy 2.4): applied on top of `dev`, 281 tests, ruff, black, mypy and `app.openapi --check` passed (the contract doesn't change, so no `pnpm contracts` commit). The production image builds with `uv sync --no-build` (658 MB, was 647 MB). `fastapi[standard]` now brings OpenTelemetry and `protobuf` (9 packages, 4.8 MB); FastAPI exports only when `OTEL_EXPORTER_OTLP_ENDPOINT` is set, which no environment does. Rebased by Dependabot, CI green, merged as 6fb46e4
  - #60 (web: Next 16.3.8 and 3 more): still open at archive time, `BLOCKED` by a lockfile conflict with #63 until Dependabot rebases it. It is a routine version update, not an alert; it follows the normal Dependabot review

## 7. Repository scanning (D5), after the user confirms

- [x] 7.1 Enable secret scanning and push protection. If the organisation blocks it, record that and stop (Q2)
  - Enabled on 2026-10-07 through the API (`security_and_analysis`): secret scanning and push protection. The organisation didn't block it (Q2: allowed). Non-provider patterns and validity checks stay off
- [x] 7.2 Enable CodeQL default setup (`python`, `javascript-typescript`, `actions`), without adding its check to the rulesets
  - Enabled on 2026-10-07 (`code-scanning/default-setup`, `query_suite: default`). Its check isn't in the rulesets
- [x] 7.3 Triage the first secret scanning and CodeQL results (fix, or dismiss with a reason). If CodeQL reports a large backlog, propose a follow-up change instead
  - The first CodeQL run (python, javascript-typescript, actions) reported 3 alerts; secret scanning reported none.
    - #1 and #2, `py/path-injection` in `layers/store.py`: dismissed as false positives. `_metadata_path` requires `language` to match `^[a-z]{2}$` and the file name to pass `_is_safe_filename`, and `test_metadata_paths_cannot_escape_the_root` covers it.
    - #3, `py/clear-text-logging-sensitive-data` in `GoogleMapsAPIHelper.py`: real. A DEBUG line logged the Static Maps URL, with the API key and the request signature. Fixed to log only center, zoom and size.
    - Reading the method found a second path CodeQL missed: an HTTP error from Google raised `httpx.HTTPStatusError`, whose message holds the URL, and it was logged at ERROR and chained into the traceback. It now logs and raises only the status code (`from None`). `tests/utils/test_google_maps_api_helper.py` checks that neither the logs nor the error carry the key or the signature
- [x] 7.4 Document both in `docs/branch_protection.md` (CodeQL is not a required check) and in the PR description or the archive notes
  - `docs/branch_protection.md` → "Security scanning": CodeQL (not a required check, and how to require it), push protection (when a bypass is acceptable, rotating a leaked secret) and Dependabot alerts
