## 1. Spike: Azure Files mount (de-risk before coding)

- [x] 1.1 Create resource group `monbo-data`, a StorageV2 `Standard_LRS` account (TLS 1.2 min, public blob access off), and SMB share `maps`, manually or with a throwaway script
- [x] 1.2 Register the share on the Container Apps environment (`az containerapp env storage set --storage-type AzureFile --access-mode ReadWrite`) and deploy a test API revision that mounts it at `/mnt/maps` with `mountOptions: uid=10001,gid=10001,dir_mode=0750,file_mode=0640`, running as uid 10001 — done with a deviation: the throwaway app (`monbo-api-spike`, now deleted) ran the unmodified production image, whose `appuser` is uid 999, so the mount used `uid=999,gid=999,dir_mode=0750,file_mode=0640` and was placed over `/app/app/maps` so the real tile code read from SMB. Pinning uid 10001 stays in task 8.1; the mount options only change the number
- [x] 1.3 From inside the revision, verify: create a file, `os.replace` over an existing file, delete, and rasterio open/read of a COG. Record the final working `mountOptions` in design.md — done; see design "Spike results". Found that `os.replace` over a file with an open reader fails and deletes the target, and that `chmod`/`shutil.copy` fail with `EPERM`. D6 and the layer-storage spec were updated accordingly
- [x] 1.4 Upload COG versions of `gfw.tif` and `cr_mocupp_perdida_ca_10m.tif`, then measure p50/p95 tile latency at z=6, z=10, and z=14 through `/deforestation_analysis/tiles`. Record the results in design.md and confirm the p95 < 300 ms target, or reopen D1 (Blob `/vsiaz/`) — done; COG on SMB p95 ≤ 60 ms, so D1 stands

## 2. Layer storage abstraction (no behavior change)

- [x] 2.1 Add `MAPS_ROOT` (default `app/maps`) to `app/config/env.py`
- [x] 2.2 Create a `LayerStore` module that owns every path under the root: index read, attributes/considerations read, raster path resolution, and the `.staging/` and `.jobs/` directories
- [x] 2.3 Rewrite `get_all_maps`, `get_map_by_id` (`app/modules/maps/helpers.py`) and `read_attributes`, `read_considerations`, `get_map_raster_path` (`app/utils/maps.py`) as thin wrappers over `LayerStore`. Grep that no other module builds `app/maps/...` paths
- [x] 2.4 Add `enabled` (default `true`) and `version` (default `1`) handling when reading index entries
- [x] 2.5 Implement atomic writes in `LayerStore` (temp file in the same dir, flush + `fsync`, `os.replace`) under one process-wide `RLock` that also covers every index and metadata **read**. Retry `os.replace` on `PermissionError` (10 × 100 ms) and keep the temp file until a read-back matches. Cache the parsed index keyed by `mtime` and size. Use only `shutil.copyfile`, never `shutil.copy`/`copystat`/`chmod` (design D6, Spike results)
- [x] 2.6 Filter `GET /maps` to enabled layers and add `version` to `BaseMapData`. Keep analysis, tiles, and `generate-image` resolving by id regardless of `enabled`
- [x] 2.7 Extend `/health` with `mapsRoot` and `mapsRootWritable`
- [x] 2.8 Tests: default root, custom root (tmp dir), legacy index defaults, enabled filtering, disabled layer still analyzable by id, atomic write (no partial file on simulated failure), and a simulated `PermissionError` on the first `os.replace` after which the index is still present and correct. Confirm the numeric baseline test is unchanged and green
- [x] 2.9 Frontend: add `version` to `MapData` and append `?v={version}` to tile URLs in `DeforestationMapOverlay.tsx`

## 3. Admin authentication

- [x] 3.1 Add `ADMIN_PASSKEY_HASH`, `ADMIN_SESSION_SECRET`, `ADMIN_SESSION_TTL_MINUTES` (default 60), `ADMIN_ALLOWED_ORIGIN`, `ADMIN_MAX_UPLOAD_MB` (default 500), and `ADMIN_STAGING_DIR` (default `/tmp/monbo-staging`) to `app/config/env.py`, with validation (hash is 64 lowercase hex characters; secret is at least 32 bytes)
- [x] 3.2 Add the passkey generator CLI (`uv run python -m app.modules.admin.passkey`) that prints a random passkey of at least 64 characters plus its SHA-256 hex, and writes nothing to disk
- [x] 3.3 Implement the stdlib token: HMAC-SHA256 over a base64url `{iat, exp, jti}` payload, with sign/verify helpers
- [x] 3.4 Implement `POST /admin/session`: constant-time hash comparison, returns `{token, expiresAt}`, generic 401 on failure
- [x] 3.5 Implement the in-memory per-IP rate limiter (5 failures / 15 min → 429 + `Retry-After`), with the IP taken from the last `X-Forwarded-For` hop or the peer. Log every attempt with outcome and IP, never the passkey
- [x] 3.6 Implement the `require_admin` dependency (Bearer, signature, expiry) and the `Origin` check against `ADMIN_ALLOWED_ORIGIN` for admin routes, login included
- [x] 3.7 Register the admin routers in `app/main.py` only when the hash and the secret are both set, with a startup warning when only one is. Log a startup warning when the admin is enabled and `MAPS_ROOT` resolves inside the repo's `app/maps`
- [x] 3.8 Update the CORS middleware: methods `GET, POST, PUT, PATCH`; headers include `Authorization` and `Content-Type`; `allow_credentials=False`
- [x] 3.9 Tests: routes absent when unconfigured, login success/failure, rate limit and `Retry-After`, expired/tampered/rotated-secret tokens rejected, origin mismatch returns 403, and logs contain no passkey

## 4. Layer administration API

- [x] 4.1 Define the admin Pydantic models: index fields, per-language attributes (`name`/`alias` required for en and es), considerations per language, and the list response with raster presence
- [x] 4.2 Implement `GET /admin/layers` (all layers, en/es metadata, raster presence)
- [x] 4.3 Implement `POST /admin/layers`: `id = max + 1` counting disabled layers, `enabled: false`, `layer-<id>.json` / `layer-<id>.md` files, and validation (baseline ≤ compared_against, pixel_size > 0, ISO alpha-2 codes via `pycountry`)
- [x] 4.4 Implement `PUT /admin/layers/{id}`: writes to the existing metadata filenames; does not touch `id`, `raster_filename`, `version`, or `enabled`; 404 for unknown ids
- [x] 4.5 Implement `PATCH /admin/layers/{id}` `{enabled}`, returning 409 when enabling without a raster file
- [x] 4.6 Tests for every endpoint and scenario in `specs/layer-administration/spec.md`, using a temporary `MAPS_ROOT`

## 5. Raster ingestion

- [x] 5.1 Implement `PUT /admin/layers/{id}/raster`: stream the raw body in chunks to `ADMIN_STAGING_DIR/<uuid>.tif` (local disk, design D3), enforce `ADMIN_MAX_UPLOAD_MB` while streaming (413 and delete the partial file), accept the optional `nodata` query parameter, return 202 with `jobId`, and return 409 if a job is queued or running
- [x] 5.2 Implement job persistence in `.jobs/<jobId>.json` and `GET /admin/jobs/{jobId}`. On startup, mark stale `queued`/`running` jobs `failed` ("interrupted by restart") and clean up their staging files. Confirm the enforced ephemeral storage quota of a 1 vCPU replica is ≥ 2 GiB (design Open Questions) — confirmed: 4 GiB for ≤ 1 vCPU (Container Apps storage docs)
- [x] 5.3 Implement structural validation (readable GeoTIFF, one band, integer dtype, CRS present) with a specific message for each failure
- [x] 5.4 Implement exhaustive windowed binary validation: distinct values ⊆ {0, 1, nodata}, up to 10 offending values listed, the loss-year hint for 1980–2100, and a warning when there are no 1s. Build the raster report (CRS, size, bounds, dtype, nodata, values, approximate resolution in meters)
- [x] 5.5 Implement COG conversion (`rasterio.shutil.copy`, driver COG, DEFLATE, predictor 2, blocksize 512, nearest overviews, keeping CRS and nodata) followed by windowed pixel-equality verification
- [x] 5.6 Implement activation: `shutil.copyfile` the local COG to `MAPS_ROOT/.staging/`, `os.replace` it to `layers/rasters/<stem>-v<version+1>.tif` (a new name, never an existing one), then update `raster_filename` and `version` in one atomic index write. Always delete local and share staging files in `finally`
- [x] 5.7 Add small generated fixture rasters (binary, stray value, loss years, multi-band, float, no CRS, nodata=3, all zeros, strip-organized uncompressed) and tests covering every scenario in `specs/raster-ingestion/spec.md`
- [x] 5.8 Measure ingestion time on 1 vCPU for the largest current input (gfw, 55 MB strips) in the spike environment and record it in design.md — 184 s when processed on the share (scan 85 s, COG 34 s, verify 64 s); this led to D3 processing on local disk. Re-measured with local staging on a laptop, end to end over HTTP with the six real layers: gfw 73 s, tmf 72 s, ideam 34 s, ecuador2 11 s, ecuador and mocupp 7 s each; results of the regression suite on the re-ingested COGs are identical

## 6. Seed existing layers

- [x] 6.1 Implement the seed CLI (`uv run python -m app.modules.layers.seed --source app/maps --target <dir>`), reusing the ingestion validation, COG, and verification code. It writes `<stem>-v1.tif`, copies the metadata, and writes an index with `enabled: true, version: 1`
- [x] 6.2 Run it locally on the six current layers. Confirm every raster passes binary validation (ecuador2 with nodata 3), pixel equality holds, and the total size is under 100 MB — done: 6 layers, 511 MB → 51.8 MB, all binary (ecuador2 with nodata 3), pixel-identical; parity with the Git-tracked layers is identical
- [x] 6.3 Write the analysis-parity script: a fixed sample of farms (reuse the numeric-baseline farms and add at least one farm per country layer) posted to `/analize` on two base URLs, asserting identical ratios — done as `uv run python -m tests.regression.parity <current-url> <candidate-url>`, using the 10 regression farms (they cover every layer) and also comparing parsed areas and validation

## 7. Admin UI (frontend)

- [x] 7.1 Add the `admin` i18n namespace (`src/locales/en/admin.json`, `src/locales/es/admin.json`) and register it in the i18n config
- [x] 7.2 Add TypeScript interfaces that mirror the admin Pydantic models, and `src/api/adminLayers.ts` (session, list, create, update, patch, raster upload via `XMLHttpRequest` with progress, job polling)
- [x] 7.3 Add `AdminSessionContext`: token in `sessionStorage`, expiry handling, redirect to login on 401, logout
- [x] 7.4 Build `src/app/[locale]/admin/page.tsx` (login)
- [x] 7.5 Build `src/app/[locale]/admin/layers/page.tsx` (list with name, alias, id, version, enabled toggle, raster presence)
- [x] 7.6 Build the create/edit form (`admin/layers/new/page.tsx`, `admin/layers/[id]/page.tsx`): index fields, a country multi-select reusing `src/utils/countries.ts`, a references list, and en/es tabs for attributes and considerations with a `react-markdown` preview
- [x] 7.7 Build the raster upload section on the edit page: `react-dropzone`, nodata input, progress bar, job polling, and the job report and errors/warnings rendered in the current language
- [x] 7.8 Confirm there are no links to `/admin` from the home page or the header, and that `tsc --noEmit`, lint, and build pass
- [x] 7.9 Fix found while testing the admin locally (it predates this change): the public app fetched `GET /maps` without `language`, so layer names, aliases and considerations were always in English. `DataProvider` now receives the locale and fetches `?language=<locale>` again when it changes, and already-selected layers are refreshed from the new list (language and `version`)

## 8. Azure infrastructure and deployment

- [x] 8.1 Pin `appuser` to uid/gid 10001 in `monbo-api/Dockerfile.prod`
- [x] 8.2 Add an `ensure_layer_storage` step to `azure/deploy.sh`: idempotently create the `monbo-data` resource group, the `CanNotDelete` lock, the Storage Account, the share (quota 10 GiB), share soft delete (14 days), daily Azure Backup snapshots (30-day retention), and the Container Apps environment storage definition — run for real with `./azure/deploy.sh storage` (idempotent: a second run changes nothing)
- [x] 8.3 Turn `azure/monbo-api-app.yml` into the rendered template for the API app, with image, CPU/memory, `minReplicas`/`maxReplicas: 1`, the `volumes`/`volumeMounts` for `/mnt/maps` with the spike's mount options, env (`MAPS_ROOT`, `ADMIN_ALLOWED_ORIGIN` computed from the environment's default domain), and the secret references (`ADMIN_PASSKEY_HASH`, `ADMIN_SESSION_SECRET`). Deploy the API with `az rest --method put` against `api-version=2024-03-01` and a rendered JSON body (`az containerapp create --yaml` is broken on az CLI 2.90; see design Spike results) — done as `azure/render_api_app.py` (the old `azure/monbo-api-app.yml` is removed); `deploy.sh` also refuses to mount an unseeded share
- [x] 8.4 Add the new variables to `azure/deploy.env.example` (`DATA_RESOURCE_GROUP`, `STORAGE_ACCOUNT_NAME`, `ADMIN_PASSKEY_HASH`, `ADMIN_SESSION_SECRET`). Make the admin opt-in: skip the secrets when they are empty
- [x] 8.5 After the API deploys, have `deploy.sh` verify that `/health` reports `mapsRoot=/mnt/maps` and `mapsRootWritable=true` (only when storage is configured), and fail otherwise
- [x] 8.6 Confirm `destroy` deletes only the app resource group, and print a note that the data resource group is kept
- [x] 8.7 Document the rotation procedure for the passkey and the session secret (generate, `az containerapp secret set`, restart the revision) — in `docs/suggested_deployment.md`, with the storage setup, seeding and rollback

## 9. Rollout

- [x] 9.1 Merge the code with `MAPS_ROOT` unset and no admin secrets. Verify production behavior is unchanged — deployed from the branch (not merged yet) as `8f4abbe` with no storage or admin: `/health` reports the image's maps, `/admin/session` is 404, and the regression farms, tiles and images are identical to a local API on the Git layers
- [x] 9.2 Seed the share: run the seed CLI locally, then `az storage file upload-batch` to `maps`, and verify the listing — 6 rasters (51.8 MB) and 24 metadata files; sizes and `index.json` match the local seed. The seed now skips hidden files (it was copying `.DS_Store`)
- [x] 9.3 Deploy with the mount, `MAPS_ROOT=/mnt/maps`, and the admin secrets. Verify `/health`, that `GET /maps` returns 6 layers, tiles at z=6 and z=12, and image generation — the admin hash and session secret are secret references; images are identical, and tiles are identical to a local API on the seeded COGs. Against the original rasters, low-zoom tiles differ because they now come from the COG's nearest overviews (D5); analysis is unaffected. The first deploy exposed a race: provisioning succeeds before the new revision is ready, so `deploy.sh` checked the old one; it now waits for `latestReadyRevisionName` and retries the maps-root check
- [x] 9.4 Run the analysis-parity script (6.3, `uv run python -m tests.regression.parity`) between the previous deployment (or a revision without `MAPS_ROOT`) and the share-backed deployment. The ratios must be identical — identical, with a local API on the Git layers as the fixed reference (itself identical to the pre-migration deployment)
- [x] 9.5 Admin acceptance in production: log in, create a test layer, upload one of the new rasters (5.8, 28.1, or 32.4 MB), confirm the job succeeds, enable it, see it in the public selector with tiles, then disable it. Edit the `es` considerations of a seeded layer and confirm the change. Deploy a new revision and confirm everything persists — done by the user on `monbo-test` (layer 6, raster 57601×69601 ingested in 51 s as `layer-6-v2.tif`). A new revision (`monbo-api--persist-check`) served the same `/maps` in es and en, the share's index was unchanged and layer 6's tiles rendered at z=6 and z=12
- [x] 9.6 Verify a rollback: deploy a revision without `MAPS_ROOT`, confirm it serves the image layers, then restore — rollback revision served the image's layers (admin off, everything identical to Git); restored to the share with the admin on

## 10. Documentation

- [ ] 10.1 Rewrite `docs/maps.md`: the admin is how layers are managed; binary/COG requirements; the loss-year binarization note pointing to `scripts/update-gfw-tmf`; `enabled`/`version` fields; versioned filenames
- [ ] 10.2 Update `docs/suggested_deployment.md`: storage resource group and lock, share and backups, mount, admin secrets, the single-replica constraint, and rollback
- [ ] 10.3 Update `docs/onboarding.md` and `monbo-api/.env.template`: `MAPS_ROOT` for local admin work (`monbo-api/.local-maps/`, gitignored), and generating local admin credentials — `.env.template` and the API README's variable list are done; `docs/onboarding.md` is still pending
- [x] 10.4 Add `monbo-api/.local-maps/` to `.gitignore`
- [ ] 10.5 Add a CHANGELOG entry
