## 1. Test reads the URL from the environment

Files: apps/web/src/components/page/landing/sampleReports.test.ts

- [x] 1.1 Replace `PRODUCTION_GEOJSON_URL` with `SAMPLE_REPORTS_API_URL` read from `process.env` (empty = unset, trailing `/` stripped). Host test: `it.skipIf(!url)`, every GeoJSON link starts with `${url}/download-geojson?content=`.
- [x] 1.2 Add the CI guard: with `process.env.CI` set and the variable unset, a test fails with a message naming `SAMPLE_REPORTS_API_URL` and the repository variable.
- [x] 1.3 Always-on checks: 5 GeoJSON links, one sample farm each (E1-001 … E1-005), all on one `https` origin, no URI on `localhost` or `127.0.0.1`; drop the `jollymoss` literal. Keep the "reads every compressed stream" test.
- [x] 1.4 **Falsification by environment** (the artefact under test is the test plus static PDFs, so there is no production code to mutate; these runs are the evidence), from `apps/web` with `pnpm exec vitest run src/components/page/landing/sampleReports.test.ts`:
  - `SAMPLE_REPORTS_API_URL=https://monbo-api.orangerock-ea3c2f53.eastus.azurecontainerapps.io` → green;
  - `SAMPLE_REPORTS_API_URL=https://example.invalid` → red on the host test;
  - unset, `CI` unset → host test skipped, the rest green;
  - unset, `CI=true` → red on the guard, naming the variable.
- [x] 1.5 Mutant for the origin check: `falsify.mjs --file apps/web/public/files/examples/en/example-report.pdf --find "https://monbo-api.orangerock-ea3c2f53.eastus.azurecontainerapps.io/download-geojson?content=%7B%22type%22%3A%22FeatureCollection%22%2C%22features%22%3A%5B%7B%22type%22%3A%22Feature%22%2C%22properties%22%3A%7B%22id%22%3A%22E1-005" --replace "https://monbo-api.orangerock-ea3c2f53.eastus.azurecontainerapps.ia/download-geojson?content=%7B%22type%22%3A%22FeatureCollection%22%2C%22features%22%3A%5B%7B%22type%22%3A%22Feature%22%2C%22properties%22%3A%7B%22id%22%3A%22E1-005" --test apps/web/src/components/page/landing/sampleReports.test.ts` with the variable unset → red (two origins). If the find is not single-site, shorten or extend it until it is.

## 2. CI passes the variable

Files: .github/workflows/ci.yml

- [x] 2.1 On the web job's `Test` step, add `env: SAMPLE_REPORTS_API_URL: ${{ vars.SAMPLE_REPORTS_API_URL }}`, with a one-line comment. Job and step names unchanged.

## 3. Docs in the repo (outside `docs/`)

Files: apps/web/public/files/examples/README.md, apps/web/README.md

- [x] 3.1 Examples README: no literal URL; the value lives in the repository variable `SAMPLE_REPORTS_API_URL`; the command exports it with `gh variable get` and uses `"$SAMPLE_REPORTS_API_URL/download-geojson"`; to change it, update the variable and regenerate both PDFs (CI stays red until then).
- [x] 3.2 `apps/web/README.md`, "Testing": one line on `SAMPLE_REPORTS_API_URL` (skipped locally without it, required in CI).

Groups 1, 2 and 3 write disjoint files.

## 4. Verification

- [x] 4.1 `grep -rn "orangerock" apps/web/src .github` returns nothing.
- [x] 4.2 `openspec validate sample-reports-api-url-from-env --strict`.
- [x] 4.3 Before pushing: the repository variable exists (manual step, see the PR's Pasos manuales).
