## Context

| Setting | API | Web | Used for |
|---|---|---|---|
| Overlap threshold % | `env.OVERLAP_THRESHOLD_PERCENTAGE` (env, validated 0–100, default 0) | `NEXT_PUBLIC_OVERLAP_THRESHOLD_PERCENTAGE` (parsed in `config/env.ts`, same rules) | API: which overlaps are reported. Web: "< X%" labels (`formatOverlapPercentage`, `isOverlapAboveThreshold`) |
| Deforestation threshold % | — | `NEXT_PUBLIC_DEFORESTATION_THRESHOLD_PERCENTAGE` | Web only: flags, labels, colours, GeoJSON export and PDF (`isDeforestationAboveThreshold`, `formatDeforestationPercentage`, `styling.ts`, `geojson.ts`) |

The web's values are baked in at build time as `__NEXT_PUBLIC_*__` placeholders and substituted by `entrypoint.sh` at container start. They are read synchronously at module load, including by helpers that run outside React when the PDF report is generated.

The web already loads data from the API at startup: `DataContext` fetches `GET /countries` and polls it.

## Goals / Non-Goals

**Goals:**

- One place to set each threshold: the API's environment.
- The web gets them from the API and keeps its helpers synchronous.
- No behaviour change for the same values.

**Non-Goals:**

- Moving other `NEXT_PUBLIC_*` settings: the API URL, the Maps key, the testing banner, the satellite request cap, the contact URL. They configure the frontend itself, or are needed before the API is known.
- Live reload of the thresholds without a page reload.
- Generated types (the next change).

## Decisions

### D1. `GET /config`, owned by a small module

A `config` router in the API (`app/modules/config/`) with a response model:

```
GET /config → 200
{ "overlapThresholdPercentage": 1.0, "deforestationThresholdPercentage": 2.0 }
```

- **Naming:** camelCase, like the API's other responses (`producerId`, `mapsRootWritable`).
- **Validation:** values come from `env.py`, which validates both at startup. An invalid value stops the API, as the overlap one already does.
- **Caching and access:** no caching headers, so a redeploy with new values takes effect on the next page load. Public, with no auth, like `/countries`.

- **Alternative: add the thresholds to `/polygons_validation` and `/analize` responses.** Narrower, but the deforestation threshold is also used where no analysis response is at hand (styling, exports). It would spread the setting across responses instead of publishing it once.

### D2. The web loads it once and gates the app

- **`src/api/config.ts`:** `getConfig()` fetches `/config`.
- **`src/config/runtime.ts`** holds the values for synchronous readers:
  - `setRuntimeConfig(config)` once;
  - `getOverlapThreshold()` and `getDeforestationThreshold()`, which throw if they are read before it's set (a bug, not a silent 0).
- **A `ConfigProvider` (or `DataContext`)** fetches on mount, calls `setRuntimeConfig`, and renders the children only once it is set. Until then it shows a full-page loading state. On failure it shows an error with a retry button, using translated strings in en and es.
- **The helpers** (`numbers.ts`, `deforestation.ts`, `styling.ts`, `geojson.ts`) replace the imported constants with the getters. Their signatures don't change, so the 21 call sites stay as they are. The PDF generation runs after the gate, so the values are always set.

- **Alternative: pass the thresholds as arguments through every helper.** Purer, but it touches every call chain, including the PDF section components, for no practical gain.

### D3. The deforestation threshold moves to the API's environment

`env.py` gains `DEFORESTATION_THRESHOLD_PERCENTAGE`, with the same parsing and validation as the overlap one. The two validations become a shared helper: same messages, 0–100, default 0. The API doesn't use the value itself; it publishes it. It is still a product setting, now owned in one place.

### D4. Configuration and Terraform

- **`apps/web`:** remove both thresholds from `config/env.ts`, `entrypoint.sh` (two `sed` lines) and the three `.env.*` files.
- **`apps/api`:** `.env.template` gains `DEFORESTATION_THRESHOLD_PERCENTAGE`.
- **Terraform `apps`:**
  - `api.tf` gets `env DEFORESTATION_THRESHOLD_PERCENTAGE = var.deforestation_threshold_percentage`;
  - `web.tf` drops two `env` blocks;
  - the variables, their names and `dev.tfvars` are unchanged;
  - `apps.tftest.hcl`: the web has 5 env vars, the threshold assertions move to the API, and a new assertion checks that the API gets both thresholds.

## Risks / Trade-offs

- **[Risk] The web is deployed with an API that lacks `/config`.** → Mitigation: both deploy from the same commit through `infra/deploy.sh`, which verifies both apps and rolls both back together. Locally, the root `pnpm dev` starts both.
- **[Risk] `/config` is unreachable.** → Mitigation: the app shows a clear, retryable error instead of rendering with wrong thresholds. The API already has to be reachable for the app to do anything; `/countries` is fetched at the same moment.
- **[Trade-off] One more request on load.** It is tiny, and it happens in parallel with `/countries`.

## Migration Plan

1. API first, in the same PR: env, route, tests.
2. Web: client, store, gate, helpers. Then remove the old variables.
3. Terraform: move the injection. Run `terraform test`.
4. Merge. CD deploys both. Verify that `/config` returns the `dev.tfvars` values, and that overlap and deforestation labels and colours match the values on screen.

**Rollback:** revert the PR, and the CD redeploys the previous version.

## Open Questions

None.
