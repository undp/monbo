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

- [ ] 5.1 Re-list the open alerts. For each one still open, dismiss it in GitHub with its reason and a comment naming the evidence (D3), after the user confirms. Record whether the `xlsx` alerts closed themselves (Q1)
- [ ] 5.2 Check that the `dev` deploy succeeded and that the deployed web parses the regression farms file

## 6. Dependabot PRs (D4), each GitHub action after the user confirms

- [ ] 6.1 Close #44, #52, #55 and #56 with a comment: the path moved in the monorepo, superseded by the current-path PR
- [ ] 6.2 #58 (`cryptography` 50, `tools/update-gfw-tmf`): run `uv sync --frozen` locally on its branch, then merge it; check that alert #108 closes
- [ ] 6.3 Triage #57, #59 and #60 (merge or close) and record the outcome here

## 7. Repository scanning (D5), after the user confirms

- [ ] 7.1 Enable secret scanning and push protection. If the organisation blocks it, record that and stop (Q2)
- [ ] 7.2 Enable CodeQL default setup (`python`, `javascript-typescript`, `actions`), without adding its check to the rulesets
- [ ] 7.3 Triage the first secret scanning and CodeQL results (fix, or dismiss with a reason). If CodeQL reports a large backlog, propose a follow-up change instead
- [ ] 7.4 Document both in `docs/branch_protection.md` (CodeQL is not a required check) and in the PR description or the archive notes
