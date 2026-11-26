## 1. Download names

Globs: apps/web/src/hooks/useReportDownload.tsx, apps/web/src/hooks/useReportDownload.test.tsx

- [x] 1.1 In `useReportDownload.test.tsx`, mock `file-saver` (`vi.mock("file-saver", () => ({ saveAs: vi.fn() }))`) and add tests (fix tripwires, observe them red against the current tree first):
  - "saves the complete report as monbo-report.pdf", for `es` and `en` (`it.each`; let `renderDownload` take the language);
  - "saves the separated reports as monbo-reports.zip";
  - "saves the large report as monbo-reports.zip".
  Each asserts `saveAs` was called once with the resolved blob and the name.
- [x] 1.2 In `useReportDownload.tsx`, add `COMPLETE_REPORT_FILE_NAME = "monbo-report.pdf"` and `REPORTS_ZIP_FILE_NAME = "monbo-reports.zip"` above the hook, with one comment: same name in every language (D1 of undp/monbo#172). Use them in the three `saveAs` calls and delete the three `TODO: internationalize filename` comments. Nothing else in the hook changes.
- [x] 1.3 Falsify with `falsify.mjs` (`--test apps/web/src/hooks/useReportDownload.test.tsx`), on the post-change tree:
  - M1 complete: `--find '"monbo-report.pdf"' --replace '"deforestation-complete-report.pdf"'`;
  - M2 separated: `--find $'getSeparatedReports();\n      saveAs(zipBlob, REPORTS_ZIP_FILE_NAME)' --replace $'getSeparatedReports();\n      saveAs(zipBlob, "deforestation-reports.zip")'`;
  - M3 large: `--find $'signal);\n        saveAs(zipBlob, REPORTS_ZIP_FILE_NAME)' --replace $'signal);\n        saveAs(zipBlob, "deforestation-reports.zip")'`.
  Adjust only the whitespace of M2/M3 to match the file exactly; each must be single-site and turn its test red.

## 2. Cover images

Globs: apps/web/public/images/*ReportCoverBackground*.png, apps/web/public/images/reportCoverBackground*.png, apps/web/src/utils/report/sections.tsx, apps/web/src/utils/report.test.tsx

Group 2 is disjoint from group 1.

- [x] 2.1 In `report.test.tsx`, inside `describe("the report's cover")`, add "draws its background from images that exist under public/" (fix tripwire, red against the current tree): render the report, take the cover `PAGE`, collect `findAll(cover.children, "IMAGE")`, map each `props.src` to `new URL(src).pathname`, assert it equals `["/images/reportCoverBackground.png", "/images/reportCoverBackgroundWhite.png", "/images/reportCoverBackgroundLeaf.png"]`, and assert each exists with `existsSync(path.join(process.cwd(), "public", pathname))`. If react-pdf's node type is not `IMAGE` in this tree, use the type the tree actually has and say so in the report.
- [x] 2.2 `git mv` the three PNGs to `reportCoverBackground.png`, `reportCoverBackgroundWhite.png` and `reportCoverBackgroundLeaf.png` (no re-encoding; `git diff --cached -M --stat` shows 100% renames) and update the three literals in `sections.tsx:176,183,190`.
- [x] 2.3 Falsify (`--test apps/web/src/utils/report.test.tsx`): M4 `--file apps/web/src/utils/report/sections.tsx --find '"/images/reportCoverBackgroundLeaf.png"' --replace '"/images/deforestationReportCoverBackgroundLeaf.png"'` turns the new test red.

## 3. Check

Files: (none written)

- [ ] 3.1 From `apps/web`: `pnpm exec vitest run src/hooks/useReportDownload.test.tsx src/utils/report.test.tsx`, `pnpm exec tsc --noEmit` and `pnpm run lint` pass.
- [x] 3.2 `git grep -n "deforestation-reports\|deforestation-complete-report\|deforestationReportCover" -- apps/web` returns nothing.
