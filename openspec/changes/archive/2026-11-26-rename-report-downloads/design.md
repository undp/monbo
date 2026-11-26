## Context

Stage 3 saves the report with `file-saver`'s `saveAs` in `useReportDownload`
(`apps/web/src/hooks/useReportDownload.tsx`): the complete PDF at line 65
(`deforestation-complete-report.pdf`), the separated reports at line 44 and the large report at
line 88 (both `deforestation-reports.zip`), each under a `TODO: internationalize filename`
(lines 43, 64, 87). The cover draws three PNGs through `assetUrl`
(`apps/web/src/utils/report/sections.tsx:176,183,190`; `assetUrl` builds an absolute URL so the
window and the PDF worker resolve it the same, `apps/web/src/utils/report/assets.ts:1-4`).
Decision D1 of undp/monbo#172 fixes the new names: `monbo-report.pdf` and `monbo-reports.zip`,
the same in both languages.

## Goals / Non-Goals

**Goals:**
- The three downloads carry the decided names in `es` and `en`.
- No asset or code path keeps the `deforestation` name for the report as a whole.
- The cover looks exactly as before.

**Non-Goals:**
- Per-farm PDF names inside the ZIP (`report_farm_<id>.pdf`,
  `apps/web/src/workers/reportPdf.worker.tsx:97`): they do not say `deforestation`.
- Translating file names; the GeoJSON download; the landing's example PDFs.

## Decisions

1. **Two module-level constants in `useReportDownload.tsx`**
   (`COMPLETE_REPORT_FILE_NAME = "monbo-report.pdf"`, `REPORTS_ZIP_FILE_NAME = "monbo-reports.zip"`)
   used by the three `saveAs` calls, with one comment saying the name is the same in every
   language (D1). The three `TODO: internationalize filename` comments are removed.
   *Alternative rejected:* translation keys — D1 decided against translated names, and a key would
   invite someone to translate it later.
2. **Rename the PNGs with `git mv`** to `reportCoverBackground.png`,
   `reportCoverBackgroundWhite.png` and `reportCoverBackgroundLeaf.png`, and update the three
   literals in `sections.tsx`. Bytes stay identical, so the cover cannot change.
   *Alternatives rejected:* keeping the old names (the issue's scope asks for the rename; the
   name is misleading for a multi-category report); a shared constant in `assets.ts` (adds an
   indirection for three literals used in one place; the test below already pins them).
3. **Tests.**
   - `useReportDownload.test.tsx` mocks `file-saver` (`vi.mock("file-saver", …)`; it is a
     library, not `@/api/*` or `fetch`, so the repo's mocking rule is respected) and asserts the
     name passed to `saveAs` for each of the three downloads, and for the complete report in
     both `es` and `en`.
   - `apps/web/src/utils/report.test.tsx`, in the existing `describe("the report's cover")`,
     renders the report, collects the `IMAGE` nodes of the cover page, asserts their pathnames
     are the three new ones, and asserts each exists under `apps/web/public/` (`node:fs`, as
     `src/locales/usedKeys.test.ts:1` already does). This catches a stale reference, which would
     otherwise surface only as a broken PDF render.

API contract, data shape, environment variables, i18n keys: N/A — the change is two string
literals, three asset paths and their tests; no route, model or `NEXT_PUBLIC_*` is touched.

Signal tracing: N/A — the plan introduces no signal between stages.

## Hazards (Step 2b)

| File | Failure mode | Evidence |
|---|---|---|
| `apps/web/src/hooks/useReportDownload.tsx` | Editing the `try` blocks could drop an error branch (worker terminated, layer changed, abort) or change the usage event. Only the `saveAs` arguments and comments may change. | Branches at lines 47-58, 68-75, 91-105; pinned by `useReportDownload.test.tsx:93-117`; last touched by #144 and #65. |
| `apps/web/src/utils/report/sections.tsx` | A path that does not exist under `public/` makes react-pdf fail to load the image, in the window and in the worker (absolute URL via `assetUrl`). | `sections.tsx:176,183,190`; `assets.ts:1-4`. |
| `apps/web/public/images/deforestationReportCoverBackground{,White,Leaf}.png` | Re-encoding would change the cover and its size; the Leaf PNG was quantized on purpose. They are plain Git blobs, not LFS (`.gitattributes` covers only rasters). | `openspec/changes/archive/2026-10-08-optimize-report-pdf-generation/tasks.md:127`; `.gitattributes:1`. |
| `apps/web/src/hooks/useReportDownload.test.tsx` | A `file-saver` mock's call history must not leak between tests: the shared setup already clears every mock after each test. | `apps/web/src/test/setup.ts:33` (`vi.clearAllMocks()`). |
| `apps/web/src/utils/report.test.tsx` | The cover test must read the rendered tree, not a constant, or it would not catch a stale path. | `report.test.tsx:145-155` (existing `findAll(cover.children, "LINK")` pattern). |

## Risks / Trade-offs

- [A tab opened before the deploy still runs the old bundle and asks for the old PNG names,
  which no longer exist] → the cover would fail to render until a reload. The deploy window is
  short and the app has no long-lived sessions (state lives in the tab); accepted.
- [Someone relies on the old download names in a script] → none known; names are user-facing.
