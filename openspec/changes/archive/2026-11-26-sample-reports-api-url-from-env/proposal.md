## Why

PR #182 pins the production API URL
(`https://monbo-api.orangerock-ea3c2f53.eastus.azurecontainerapps.io`) as a literal in
`apps/web/src/components/page/landing/sampleReports.test.ts` and in the examples
README. Production is a manual deployment (D5 of undp/monbo#172), so the URL may change;
the owner wants it out of the code, in one place that is easy to change.

The URL is also baked into the two sample PDFs, which are static files: changing it will
always mean regenerating them. What can move out of the code is the value the test checks
the PDFs against and the value the regeneration uses.

## What Changes

- A new environment variable, `SAMPLE_REPORTS_API_URL` (production API's base URL), read
  by `sampleReports.test.ts` instead of the literal. It is not `NEXT_PUBLIC_*`: no runtime
  code reads it, so the four-file `NEXT_PUBLIC_*` rule does not apply.
- In CI the value comes from a GitHub repository variable of the same name
  (`vars.SAMPLE_REPORTS_API_URL`), passed to the web job's `Test` step. Under CI the test
  fails if the variable is missing, so the check never silently weakens there.
- Locally, without the variable, the host-pinning test is reported as skipped; the rest
  (5 links, one farm each, all on one `https` origin, none on `localhost`) still runs.
- The examples README regenerates with `NEXT_PUBLIC_DOWNLOAD_GEOJSON_URL="$SAMPLE_REPORTS_API_URL/download-geojson"`
  and says where the value lives (`gh variable get SAMPLE_REPORTS_API_URL`).
- The dev-host literal (`jollymoss`) leaves the test too: in CI, "equals the configured
  production URL" already excludes it.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `landing-page`: "The sample reports link GeoJSON to the production API" names the
  configured `SAMPLE_REPORTS_API_URL` instead of a literal URL, and states when the
  check runs.

## Impact

- `apps/web/src/components/page/landing/sampleReports.test.ts`,
  `.github/workflows/ci.yml` (web job, `Test` step env), `apps/web/public/files/examples/README.md`,
  `apps/web/README.md` ("Testing": the variable and how to set it locally).
- Manual step before merge: create the repository variable
  `SAMPLE_REPORTS_API_URL=https://monbo-api.orangerock-ea3c2f53.eastus.azurecontainerapps.io`;
  without it the web job's tests fail.
- Non-goals: changing the PDFs (they already point at production); deriving the URL from
  Terraform outputs; part B of MB-10.
