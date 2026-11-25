## Why

Two product settings are configured on both sides of the app:

- **`OVERLAP_THRESHOLD_PERCENTAGE`.** The API reads it to decide which polygons overlap (`polygons_validation/helpers.py`). The web reads its own copy, `NEXT_PUBLIC_OVERLAP_THRESHOLD_PERCENTAGE`, to display small overlaps as "< X%". `env.py` and `env.ts` each say "Ensure the same value at frontend/backend", and each parses and validates the value its own way.
- **`DEFORESTATION_THRESHOLD_PERCENTAGE`** exists only in the web (`NEXT_PUBLIC_*`). It is still a product rule that the API has no say in, and it is baked into the frontend's environment.

In Azure, Terraform feeds both sides from one value, so they can't diverge there. Locally, each app has its own `.env`, and the technical review lists the duplication as open debt. `GET /countries` already established the pattern of the API publishing what the web needs; the thresholds belong there too.

This is the first of two small changes. The second, `api-contract-codegen`, generates the web's types from the API's OpenAPI, which will include this endpoint.

## What Changes

- **The API owns both thresholds.**
  - `env.py` gains `DEFORESTATION_THRESHOLD_PERCENTAGE`, validated 0–100 like the overlap one, default 0.
  - **`GET /config`** returns `{overlapThresholdPercentage, deforestationThresholdPercentage}`. It has a response model, is public, and is uncached by the API.
- **The web reads its configuration from the API.**
  - `api/config.ts` fetches `/config` once at startup.
  - The value is kept in a small module store, so the synchronous helpers keep working (`utils/numbers.ts`, `deforestation.ts`, `geojson.ts`, `styling.ts`, the PDF report).
  - The app shows a loading state, and a retryable error, until it arrives.
- **BREAKING (configuration):** `NEXT_PUBLIC_OVERLAP_THRESHOLD_PERCENTAGE` and `NEXT_PUBLIC_DEFORESTATION_THRESHOLD_PERCENTAGE` are removed from:
  - `config/env.ts` and `entrypoint.sh`;
  - the `.env.*` examples;
  - `infra/terraform/apps/web.tf`.

  Both values are now set on the API (`OVERLAP_THRESHOLD_PERCENTAGE`, `DEFORESTATION_THRESHOLD_PERCENTAGE`). In Azure, `apps/envs/<env>.tfvars` keeps the same variable names; only where they are injected changes.
- **Docs and agent skills.** These are updated:
  - the API and web READMEs;
  - the onboarding guide;
  - `infra/README.md`;
  - the `NEXT_PUBLIC_*` checklist in the PR skills.

## Capabilities

### New Capabilities

- `product-configuration`:
  - the API is the single owner of product settings that the web needs;
  - `GET /config`, its shape and its validation;
  - the web loads it before rendering the modules, and fails visibly if it can't.

### Modified Capabilities

None. No existing spec covers the thresholds. The infrastructure specs don't list the web's variables.

## Impact

- **API:**
  - `app/config/env.py`;
  - a new `GET /config` route and response model (it also appears in the OpenAPI);
  - tests.
- **Web:**
  - `src/config/env.ts`, `entrypoint.sh` and the `.env.*` examples;
  - new `src/api/config.ts` and a config store;
  - `DataContext` or the root layout (load and gate);
  - `utils/numbers.ts`, `utils/deforestation.ts`, `utils/geojson.ts`, `utils/styling.ts` and the components that call them (about 21 call sites in 9 files).
- **Terraform:**
  - `apps/api.tf` passes `DEFORESTATION_THRESHOLD_PERCENTAGE`;
  - `apps/web.tf` drops two `NEXT_PUBLIC_*` variables;
  - `apps/tests/apps.tftest.hcl` (the web app now has 5 env vars).
- **Behaviour:** none intended. The same values produce the same flags and labels. A page load makes one more small request.
- **Deploy:** merging deploys both apps. The web needs the new API (`/config`) and both deploy together, so there is no window where the web is newer than the API.
