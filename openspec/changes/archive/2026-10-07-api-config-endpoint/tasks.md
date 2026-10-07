## 1. API

- [x] 1.1 `app/config/env.py`:
  - factor the overlap threshold's parsing into a helper (0–100, default 0, same messages);
  - add `DEFORESTATION_THRESHOLD_PERCENTAGE`;
  - add it to `.env.template`
- [x] 1.2 New `app/modules/config/` with `ConfigData` (`overlapThresholdPercentage`, `deforestationThresholdPercentage`) and `GET /config` (`response_model=ConfigData`). Register it in `create_app`
- [x] 1.3 Tests:
  - `GET /config` with set values and with defaults;
  - invalid values (out of range, not a number) fail at import.
  Run pytest, ruff, black and mypy
  - Result: 270 passed (11 new); ruff, black and mypy are clean.
- [x] 1.4 `apps/api/README.md`: the environment variables section (new variable, the web reads both from `/config`)

## 2. Web

- [x] 2.1 `src/api/config.ts` (`getConfig`), and `src/config/runtime.ts` (`setRuntimeConfig`, plus `getOverlapThreshold` and `getDeforestationThreshold` that throw if read before setting) (D2)
- [x] 2.2 Load the config at startup before rendering the modules: a loading state, and a translated error with retry (`locales/en`, `locales/es`). Place it in `DataContext` or a provider in the root layout
- [x] 2.3 Replace the constants with the getters in `utils/numbers.ts`, `utils/deforestation.ts`, `utils/styling.ts` and `utils/geojson.ts`, keeping their signatures. Check the other call sites need no change
- [x] 2.4 Remove both thresholds from `src/config/env.ts`, `entrypoint.sh` and `.env.template` / `.env.development.example` / `.env.production.example`
- [x] 2.5 `apps/web/README.md`: environment variables. Run tsc, lint and build
  - Result: tsc and build pass (25/25 static pages; the gate's loading state is what gets prerendered, so nothing reads a threshold at build time). Lint has no errors and 19 warnings, the same as before: the gate's first version added one (setState in an effect), which was fixed.
  - Only `numbers.ts` and `deforestation.ts` imported the constants; `styling.ts` and `geojson.ts` call their helpers. `numbers.ts` computed its decimal places at module load, so they are now computed per call.

## 3. Infrastructure and docs

- [x] 3.1 `infra/terraform/apps`:
  - `api.tf` adds `DEFORESTATION_THRESHOLD_PERCENTAGE`;
  - `web.tf` drops the two `NEXT_PUBLIC_*` threshold variables (update its header comment);
  - `tests/apps.tftest.hcl`: the web has 5 env vars, and an assertion that the API gets both thresholds.
  Run fmt, validate and test
- [x] 3.2 `docs/onboarding.md`, `infra/README.md` and the `NEXT_PUBLIC_*` checklist in `.claude/skills/pr-review` and `pr-comment-triage`, wherever thresholds are mentioned. `CHANGELOG.md` Unreleased
- [x] 3.3 Check locally: root `pnpm dev`, then `/config` answers, and the validation and deforestation pages show "< X%" and colours by the API's values; a PDF export works
  - With the root `pnpm dev` (`OVERLAP=1`, `DEFORESTATION=2`), `GET /config` returns `{1.0, 2.0}` with `Access-Control-Allow-Origin: *`, and the web's server-rendered HTML shows the gate's loading state.
  - In a browser, with the regression suite's 10 farms: the pages render after `/config` loads and the app looks right. With `DEFORESTATION_THRESHOLD_PERCENTAGE=1`, the only value at or under the threshold is F08 on Ecuador's MAATE 2020-2023 layer (0.33%), shown as "< 1%". The validation page never shows "< X%": the API only returns overlaps above the overlap threshold.

## 4. Wrap-up

- [x] 4.1 Run `openspec validate api-config-endpoint`
- [x] 4.2 Commit on `BlancaMunizaga/api-config-and-contracts`; one PR into `dev` together with `api-contract-codegen` (the user's choice). After the merge, check that CD deployed both apps and that `/config` returns the `dev.tfvars` values
  - Done: merged as #62 (06fa045). The deploy run succeeded, and the `dev` API's `GET /config` returns `{"overlapThresholdPercentage": 1.0, "deforestationThresholdPercentage": 2.0}`, the `dev.tfvars` values. Its OpenAPI reports version 1.5.1 with 17 paths
