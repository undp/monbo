## 1. Test first (fix tripwire)

Files: apps/web/src/components/page/landing/sampleReports.test.ts

- [x] 1.1 Write `sampleReports.test.ts` as in design.md, decision 2: for `es/ejemplo-reporte.pdf` and `en/example-report.pdf`, extract every `/URI` (raw bytes and inflatable FlateDecode streams), then assert exactly 5 `/download-geojson` links, all starting with `https://monbo-api.orangerock-ea3c2f53.eastus.azurecontainerapps.io/download-geojson?content=`, each `content` a FeatureCollection with one feature, ids exactly E1-001 … E1-005, and no URI containing `localhost`, `127.0.0.1` or `jollymoss`.
- [x] 1.2 **Fix tripwire:** run `pnpm exec vitest run src/components/page/landing/sampleReports.test.ts` from `apps/web` against the current (pre-change) PDFs and record that it is red because the links point at `jollymoss-3d07235c.eastus2` (the id and count assertions must pass on the old PDFs: only the host assertion fails).

## 2. Regenerate the samples

Files: apps/web/public/files/examples/es/ejemplo-reporte.pdf, apps/web/public/files/examples/en/example-report.pdf

- [x] 2.1 Start the API with `GCP_MAPS_PLATFORM_API_KEY= GCP_MAPS_PLATFORM_SIGNATURE_SECRET=` (rasters present via LFS) and the web with `NEXT_PUBLIC_MAX_REQUESTS_FOR_SATELLITE_BACKGROUND_AT_DEFORESTATION_IMAGE_GENERATION=1` and `NEXT_PUBLIC_DOWNLOAD_GEOJSON_URL=https://monbo-api.orangerock-ea3c2f53.eastus.azurecontainerapps.io/download-geojson`, from this branch (current `dev`).
- [x] 2.2 For `es` and `en`, follow `apps/web/public/files/examples/README.md` steps 1–6 and replace the two PDFs with the app's bytes (design.md, decision 1).
- [x] 2.3 Check README step 7 on both PDFs (no satellite photo behind any farm map, no Google Maps mention) by rendering their pages to images and looking at them.
- [x] 2.4 Open at least one GeoJSON link per language against production (`curl`), and confirm 200 with that farm's single feature; record the commands and outputs for the PR.

## 3. README

Files: apps/web/public/files/examples/README.md

- [x] 3.1 Replace the "Today that is the dev environment's API …" paragraph with one that names the production API as the public one, and say that `sampleReports.test.ts` checks the links.
- [x] 3.2 In the command block, `NEXT_PUBLIC_DOWNLOAD_GEOJSON_URL=https://monbo-api.orangerock-ea3c2f53.eastus.azurecontainerapps.io/download-geojson` and the comment "(the public API: production's)".

Groups 1, 2 and 3 write disjoint files.

## 4. Verification

- [x] 4.1 The test of 1.1 is green on the regenerated PDFs.
- [x] 4.2 **Regression guard falsified:** `node "${INVENTURES_PIPELINE_HOME:-$HOME/.inventures-pipeline}/current/runtime/falsify.mjs" --file apps/web/public/files/examples/en/example-report.pdf --find "%22E1-005%22" --replace "%22E1-004%22" --test apps/web/src/components/page/landing/sampleReports.test.ts` turns it red (the ids are no longer E1-001 … E1-005). If the find string is not single-site, extend it with the next characters of that link until it is; never use a larger mutation.
- [ ] 4.3 `pnpm exec tsc --noEmit`, `pnpm run lint` and `pnpm test` in `apps/web`.
- [x] 4.4 `openspec validate regenerate-example-reports-prod-links --strict`.
