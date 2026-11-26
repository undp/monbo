## Why

The report covers every layer category (deforestation, protected areas, agricultural frontier), but
its downloads are still named as when it only covered deforestation:
`deforestation-complete-report.pdf` and `deforestation-reports.zip`
(`apps/web/src/hooks/useReportDownload.tsx:44,65,88`). The cover images carry the same legacy name
(`apps/web/public/images/deforestationReportCoverBackground{,White,Leaf}.png`, used at
`apps/web/src/utils/report/sections.tsx:176,183,190`). Decision D1 of the orchestration
undp/monbo#172 (2026-11-25): the complete PDF is `monbo-report.pdf` and the ZIP is
`monbo-reports.zip`, the same in both languages.

## What Changes

- The complete report downloads as `monbo-report.pdf`; the separated reports and the large report
  download as `monbo-reports.zip`, whatever the UI language. The `TODO: internationalize filename`
  comments go away: the name is deliberately not translated.
- The three cover images are renamed to `reportCoverBackground.png`,
  `reportCoverBackgroundWhite.png` and `reportCoverBackgroundLeaf.png` (byte-identical, `git mv`),
  and the report references them through one constant.
- Tests pin both download names and check that every cover image the report references exists
  under `public/`.

## Non-goals

- The names of the per-farm PDFs inside the ZIP (`report_farm_<id>.pdf`,
  `apps/web/src/workers/reportPdf.worker.tsx:97`): they do not say `deforestation`, so they stay.
- The GeoJSON download name, the landing's example PDFs (`LandingSteps.tsx:30-31`) and any
  translated file name.
- Any change to the PDF's content or layout: the cover must look exactly as before.

## Capabilities

### New Capabilities

### Modified Capabilities
- `report-generation`: adds the requirement that fixes the downloaded file names.

## Impact

- Web only: `apps/web/src/hooks/useReportDownload.tsx`, `apps/web/src/utils/report/assets.ts`,
  `apps/web/src/utils/report/sections.tsx`, the three PNGs under `apps/web/public/images/`, and
  their tests. No API, contract, environment variable or translation change.
