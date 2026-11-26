## Context

The start page opens a sample report per language (`SAMPLE_REPORT` in
`apps/web/src/components/page/landing/LandingSteps.tsx:29-32`, pinned by
`LandingPageContent.test.tsx:120-121`). The report is built in the browser; each farm
sheet links its GeoJSON as `${DOWNLOAD_GEOJSON_URL}?content=<encodeURIComponent(JSON)>`
(`apps/web/src/utils/report/sections.tsx:344` and `:407`). `DOWNLOAD_GEOJSON_URL` is
`NEXT_PUBLIC_DOWNLOAD_GEOJSON_URL`, falling back to `${NEXT_PUBLIC_API_URL}/download-geojson`
(`apps/web/src/config/env.ts:70-74`), so the samples can point that one link at a public
API while the rest of the local web uses the local API
(`apps/web/public/files/examples/README.md:26-29`).

The API side, `GET /download-geojson` (`apps/api/app/main.py:85-106`), only decodes the
`content` parameter, parses it as JSON and returns it as an attachment; it has no
dependency on the 2.0 contract. Checked on 2026-11-26: production answers
`/openapi.json` with version 1.5.1, and each of the 10 links of the current samples, with
the host swapped to production, returned 200 `application/json` with the FeatureCollection
of its own farm (E1-001 … E1-005, both languages; URLs of 1,292–1,753 characters). The dev
API (`jollymoss-3d07235c.eastus2`) did not answer `/health/live`.

## Goals / Non-Goals

**Goals:**

- Both sample PDFs rebuilt from current `dev` (with MB-1, MB-2 and MB-5), without the
  satellite background, every GeoJSON link on the production API.
- A unit test that keeps a future regeneration from shipping a `localhost` or dev link.
- The README's regeneration procedure names the production API.

**Non-Goals:**

- Part B of MB-10 (`LEGACY_ANALYZE_PATH` in `apps/api/tests/regression/pipeline.py`),
  blocked by Q1 of undp/monbo#172.
- Changing the link format or the report layout.
- Deploying 2.0.0 to production.

## Decisions

1. **Regenerate through the app, as the README says** (`README.md:15-60`): API started
   without the Maps key, web with `NEXT_PUBLIC_MAX_REQUESTS_FOR_SATELLITE_BACKGROUND_AT_DEFORESTATION_IMAGE_GENERATION=1`
   and `NEXT_PUBLIC_DOWNLOAD_GEOJSON_URL=https://monbo-api.orangerock-ea3c2f53.eastus.azurecontainerapps.io/download-geojson`,
   Costa Rica, the Excel example, every layer, one PDF with every polygon.
   *Alternative rejected:* rewriting the host inside the existing PDFs. It is shorter,
   but the PDFs would keep the pre-MB-1/2/5 content, and editing a PDF's bytes breaks its
   xref offsets.
   The download goes through `file-saver`'s `saveAs` (`apps/web/src/hooks/useReportDownload.tsx:65`).
   If the coder drives the app from an automated browser that cannot save downloads, it
   may capture the PDF blob in the page (for example by wrapping `URL.createObjectURL`
   before pressing "Descargar") and write those exact bytes; the bytes must be the ones
   the app produced, never re-encoded.
2. **The test reads the committed PDFs, not a generated one.** It lives at
   `apps/web/src/components/page/landing/sampleReports.test.ts`, next to the start page
   that serves the samples, reads them with `readPublicFile` (`apps/web/src/test/files.ts:8-9`),
   and extracts every `/URI (…)` string from the raw bytes and from each FlateDecode
   stream it can inflate (`node:zlib`), unescaping PDF string escapes. Today the link
   annotations are plain objects (verified with `grep -a "/URI ("` on the current PDF),
   but inflating streams keeps the test valid if the renderer starts compressing them.
   It asserts, per language:
   - every `/download-geojson` link starts with
     `https://monbo-api.orangerock-ea3c2f53.eastus.azurecontainerapps.io/download-geojson?content=`;
   - no URI contains `localhost`, `127.0.0.1` or `jollymoss` (the dev environment);
   - there are exactly 5 GeoJSON links, each `content` decodes to a FeatureCollection
     with one feature, and their `id`s are exactly E1-001 … E1-005.
   The production URL is a literal in the test and in the README, not a new
   `NEXT_PUBLIC_*` variable or config constant: no runtime code reads it.
   *Alternative rejected:* asserting only "no localhost". It would let a future
   regeneration point at dev again, which is the bug this unit fixes.
3. **Spec:** a new `landing-page` requirement (the samples are the start page's), not a
   `category-report` one: the live report must keep linking whatever API the deployment
   configures.

## Data shape / API contract / cross-stack wiring

N/A: no model, route, env var or `schema.d.ts` change; the link format is unchanged.

## Hazards (Step 2b)

| File | Failure mode | Evidence |
|---|---|---|
| `apps/web/public/files/examples/es/ejemplo-reporte.pdf`, `en/example-report.pdf` | A regenerated sample embeds Google Maps satellite imagery (terms forbid serving it as a static file) or links `localhost`/dev | `README.md:20-33`; current PDFs link dev (10 links, checked 2026-11-26); last regenerated in #141 (`eaa413d0`) |
| same | Stale content if built from an old tree (production date one day early, "100%" for 99.95 %, layer texts in the wrong language) | MB-1 #175, MB-2 #174, MB-5 #177 merged in `dev` (`95e7d3f`) |
| `apps/web/public/files/examples/README.md` | The procedure keeps naming the dev API and the closed follow-up | `README.md:31-33`, `:39-40` |
| `apps/web/src/components/page/landing/sampleReports.test.ts` (new) | A parser that silently finds 0 links passes vacuously | Guarded by asserting exactly 5 links per PDF |
| production `/download-geojson` | A very long `content` URL rejected by the ingress | Longest current link 1,753 chars returned 200 on 2026-11-26 |

## Signal tracing

N/A: the change introduces no signal between stages.

## Risks / Trade-offs

- [Production's API URL changes (manual deployment, D5)] → the test fails on the next
  run against a new expected URL only if someone updates it; the samples then break like
  today. Mitigation: the README names the URL and the test pins it, so a new URL is a
  visible two-line change plus a regeneration.
- [Production runs 1.5.1 until Q1 closes] → `/download-geojson` is version-independent
  (`apps/api/app/main.py:85-106`), checked on production on 2026-11-26.
- [Binary PDFs in Git] → ~0.5 MB each, same as today; not LFS-tracked today and not
  rasters, so they stay normal blobs.

## Open Questions

None blocking part A. Q1 of #172 blocks only part B.
