## Why

Every farm sheet of the two sample reports on the start page links its GeoJSON to the
dev environment's API (`https://monbo-api.jollymoss-3d07235c.eastus2.azurecontainerapps.io/download-geojson`,
in all 10 links of `apps/web/public/files/examples/{es,en}/`). That API did not answer on
2026-11-25 nor on 2026-11-26, so a reader of the sample gets a broken link. Production
now has a stable API URL (decision D5 of undp/monbo#172), and its `/download-geojson`
(version 1.5.1) already returns each farm's GeoJSON for the links the 2.0 builds: on
2026-11-26 the 10 current links, with only the host changed to production, all answered
200 with the GeoJSON of their own farm (E1-001 to E1-005, in both languages).

The samples are also stale: `dev` now carries the production-date fix (MB-1, #175), the
finding-percentage fix (MB-2, #174) and the layer texts in the report's language (MB-5,
#177), which change what the PDF shows.

## What Changes

- Regenerate `apps/web/public/files/examples/es/ejemplo-reporte.pdf` and
  `apps/web/public/files/examples/en/example-report.pdf` from current `dev`, with the
  GeoJSON link pointed at the production API.
- Add a web unit test that reads both sample PDFs and fails when a GeoJSON link points
  anywhere but the production API's `/download-geojson`, or when a link does not carry
  exactly one sample farm.
- Update `apps/web/public/files/examples/README.md`: the regeneration command uses the
  production API, and the "today that is the dev environment's API" follow-up note goes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `landing-page`: a new requirement that the sample reports' GeoJSON links point at the
  production API's `/download-geojson`, one sample farm per link, never at `localhost`
  or another environment.

## Impact

- Files: the two sample PDFs (binary), the examples README, one new Vitest file under
  `apps/web/src/components/page/landing/`.
- No API, contract, env-var or infrastructure change. The PDFs ship in the web image, so
  they reach the production start page with the next release to `main`.
- Non-goals: removing `LEGACY_ANALYZE_PATH` from `apps/api/tests/regression/pipeline.py`
  (part B of MB-10, blocked by Q1 of #172); deploying 2.0.0 to production; changing how
  the report builds its GeoJSON link (`apps/web/src/utils/report/sections.tsx`).
