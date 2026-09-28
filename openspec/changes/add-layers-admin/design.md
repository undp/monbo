## Context

Layers are resolved from files under `monbo-api/app/maps/`:

- `index.json` holds, per layer: `id`, `raster_filename`, `attributes_filename`, `considerations_filename`, `pixel_size`, `baseline`, `compared_against`, `references`, and `available_countries_codes`.
- `metadata/attributes/<lang>/*.json` and `metadata/considerations/<lang>/*.md` hold the per-language metadata.
- `layers/rasters/*.tif` holds the rasters (Git LFS, ~511 MB).

`get_all_maps()`, `read_attributes()`, `read_considerations()`, and `get_map_raster_path()` (`app/modules/maps/helpers.py`, `app/utils/maps.py`) read from disk on every request with no caching, and every other module goes through them. The files are copied into the API image (`COPY ./app`). The API runs on Azure Container Apps (1 replica; `azure/deploy.sh` defaults to 1 CPU / 2 GiB), and its container filesystem is ephemeral. There is no database and no authentication. The browser calls the API directly (`NEXT_PUBLIC_API_URL`) from a different `*.azurecontainerapps.io` origin.

The current rasters, measured during exploration:

| Raster | Size | Layout | Compression | Overviews | CRS | nodata |
|---|---|---|---|---|---|---|
| cr_mocupp_perdida_ca_10m | 344 MB | strips | none | none | EPSG:4326 | 0 |
| ecuador | 63 MB | 128 tiles | none | none | EPSG:32717 | 0 |
| gfw | 55 MB | strips | LZW | none | EPSG:4326 | — |
| tmf | 47 MB | 256 tiles | LZW | none | EPSG:4326 | — |
| ideam | 22 MB | strips | LZW | none | EPSG:3116 | — |
| ecuador2 | 4 MB | 128 tiles | LZW | none | EPSG:32717 | 3 |

All are single-band `uint8` with values in {0, 1} (plus nodata). New layers are expected to be similar in size: 5.8, 28.1, and 32.4 MB were given as examples.

Converting three of them to COG (DEFLATE, predictor 2, 512 blocks, nearest overviews) produced pixel-identical data:

| Raster | Size | Tile at z=6 (country view) | Tile at z=12 |
|---|---|---|---|
| cr_mocupp | 344 → 0.6 MB | 3200 → 3 ms | 110 → 7 ms |
| ideam | 22 → 5.3 MB | 3993 → 78 ms | 77 → 221 ms |
| gfw | 55 → 23 MB | 2493 → 6 ms | 10 → 7 ms |

Conversion took 2–33 s on a developer laptop.

Decisions already made with the product owner:
- Authentication is a long shared secret.
- There is a single environment for now.
- Uploaded rasters are already pre-processed and must be checked to be binary.
- Layers added through the admin are stored only in cloud storage, not in Git.
- The admin replaces Git as the way layers are managed.

## Spike results (2026-09-25)

Task group 1 mounted the `maps` share (`monbo-data` / `monbodata`) into a throwaway Container App (`monbo-api-spike`, 1 vCPU / 2 GiB, the production image `f29eb93`) over `app/maps`, so the real tile code read from SMB. The throwaway app was deleted afterwards. The share and its environment storage registration were kept.

**Mount.** With no `mountOptions`, Azure mounts the share as `uid=0,gid=0,file_mode=0777,dir_mode=0777` with `actimeo=1,closetimeo=1,persistenthandles,nosharesock`. With `mountOptions: uid=999,gid=999,dir_mode=0750,file_mode=0640` (999 is `appuser` in the current image), the share root and new files are owned by the app user with those modes, and the app user can create, write, rename, and delete. `closetimeo` is rejected by Container Apps (`ContainerAppVolumeMountOptionsNotSupported`), and it turned out not to be needed.

**SMB rename semantics (as the app user, restrictive mount):**

| Operation | Result |
|---|---|
| `os.replace(tmp, target)` with no reader, 10× | ok 10/10 |
| `os.replace(tmp, target)` right after a reader closed `target`, 10× | ok 10/10 (deferred close is not a problem) |
| `os.replace(tmp, target)` **while a reader holds `target` open** | **fails with `EACCES`, and `target` is deleted when the reader closes**. `tmp` survives |
| `os.remove(file)` while a reader holds it open | ok. The reader keeps reading; the file disappears on close |
| `os.replace` across directories on the share (8 MB) | ok |
| `os.chmod` / `shutil.copy` (which calls chmod) | `EPERM`. `shutil.copyfile` works |

**Tile latency inside the container** (`get_tile`, 9 tiles × 2 passes per zoom; p50 / p95 / first cold tile, ms):

| Raster | z=6 | z=10 | z=14 |
|---|---|---|---|
| gfw COG on SMB | 23 / 59 / 102 | 26 / 35 / 58 | 22 / 29 / 33 |
| gfw COG on local disk | 11 / 15 / 15 | 14 / 17 / 12 | 12 / 16 / 12 |
| cr_mocupp COG on SMB | 24 / 35 / 41 | 28 / 45 / 45 | 27 / 31 / 26 |
| gfw original (no overviews) on SMB | 3655 / 3881 / 3955 | 99 / 109 / 99 | 36 / 40 / 33 |
| gfw original on local disk | 3648 / 3866 / 3724 | 85 / 88 / 85 | 20 / 24 / 14 |

The first run with the default mount gave the same picture (COG on SMB p95 ≤ 75 ms, cold ≤ 142 ms). **The p95 < 300 ms target is met.** SMB adds ~10–15 ms per tile over local disk. The low-zoom cost of today's rasters comes from the missing overviews, not from the storage.

**End to end from a client in Chile** (p50, ms; `/health` round trip ≈ 407 ms): gfw z=6 is 3920 in production (original raster on the image disk) vs 433 on the spike (COG on SMB). At z=10 and z=14 both sit at the network floor (~430–480).

**Ingestion cost, worst current input** (gfw original, 55 MB strips, staged and processed on the share, 1 vCPU): exhaustive binary scan 84.6 s, COG conversion 34.3 s, windowed pixel verification 64.1 s, **total 184 s**. The pixels were identical and the COG was 22.6 MB. The scan and the verification are I/O-bound over SMB (15 s and 11 s on a laptop's local disk). Conversion is CPU-bound either way.

**Ephemeral disk.** `/tmp` reported 11.8 GB free in the container.

**Tooling.** `az containerapp create --yaml` on az CLI 2.90 sends a body that the preview API (`2025-10-02-preview`) rejects (`could not be converted to System.Boolean`). A `PUT` through `az rest` with `api-version=2024-03-01` and an explicit JSON body works, including `volumes[].mountOptions`.

## Goals / Non-Goals

**Goals:**
- An admin can create, edit, and enable/disable layers, and replace a layer's raster, without a rebuild or redeploy.
- Layers persist across releases, restarts, and new revisions.
- Uploaded rasters are verified to be binary and are normalized to COG before they become visible.
- Open-source deployments without Azure or the admin keep working exactly as today.
- Zero change to the numeric results of analyses. The existing numeric baseline stays green, and seeded layers are pixel-identical to the originals.

**Non-Goals:**
- Removing layers from Git. That is the follow-up change `remove-layers-from-git`.
- Raster pre-processing in the app: binarizing loss-year bands, clipping to countries, reprojection. `scripts/update-gfw-tmf` remains the tool for that.
- Per-person admin identities, Entra ID, or WebAuthn passkeys.
- Hard deletion of layers, rollback to a previous raster version from the UI, and an audit history UI.
- Multiple environments or promoting layers between them.
- Scaling the API above 1 replica.
- Validating that raster bounds match `available_countries_codes`.

## Decisions

### D1: Azure Files mounted at `/mnt/maps`, selected with `MAPS_ROOT`

A new `LayerStore` module (`app/modules/layers/store.py` or similar) owns every path under a configurable `MAPS_ROOT` (default `app/maps`, which is today's behavior). The on-disk layout under the root stays the same as today (`index.json`, `metadata/...`, `layers/rasters/...`), plus two hidden working directories: `.staging/` (only finished COGs waiting for their same-share rename into `layers/rasters/`) and `.jobs/`. The existing helpers become thin wrappers over `LayerStore`, so the analysis, tile, and image-generation code does not change.

In Azure, an Azure Files share is mounted at `/mnt/maps` and `MAPS_ROOT=/mnt/maps`. The mount goes on a separate path instead of over `/app/app/maps`, so the image's own files stay visible for fallback and rollback.

*Alternatives considered:*
- **Blob Storage with GDAL `/vsiaz/`.** Rejected for now:
  - It requires rewriting paths and adding a metadata SDK with an in-memory cache.
  - Each tile request reopens the raster, costing ~50–150 ms of HTTP per request.
  - Managed-identity support in GDAL's `/vsiaz` for Container Apps is unverified.
  - Local development would need Azurite or a second implementation.

  With COG and files of 5–35 MB, Blob has no performance advantage. Revisit it if per-file versioning, managed-identity-only access, or much larger files become requirements. `LayerStore` keeps the change contained.
- **Blob as source of truth with a local cache.** Rejected: startup gets slower and ephemeral storage is limited.
- **GitOps** (the admin opens a PR). Rejected: slow, needs a GitHub token in production, and LFS through the API is impractical.

### D2: The share is the single source of truth, and Git is only the initial seed

After seeding (D11), all layer changes go through the admin. The Git copy under `app/maps` is frozen until `remove-layers-from-git` deletes it.

*Alternative considered:* two roots (read-only system layers from the image plus admin layers from the share, merged). Rejected: it keeps two ways of managing layers, adds merge and id-collision logic, and the owner confirmed the admin replaces Git.

### D3: Upload through the API as a raw request body, processed on local disk

`PUT /admin/layers/{id}/raster` accepts the file as the raw body (`Content-Type: image/tiff` or `application/octet-stream`), not multipart. The handler streams it in chunks to a local staging directory, `ADMIN_STAGING_DIR` (default `/tmp/monbo-staging`), so it is never held in memory. The size cap is `ADMIN_MAX_UPLOAD_MB` (default 500) and is enforced while streaming. Validation and COG conversion (D4, D5) run on that local copy. Only the finished COG is copied to the share, with `shutil.copyfile`, into `.staging/`, and then renamed into place. The spike showed why: the exhaustive scan and the verification are I/O-bound and took 85 s and 64 s over SMB, versus about 15 s and 11 s locally. `/tmp` reported 11.8 GB free, well above the 500 MB cap plus its COG. Losing the local copy on a restart is harmless, because D7 marks interrupted jobs as failed. The frontend uses `XMLHttpRequest` for upload progress.

*Alternative considered:* a SAS token for direct browser-to-storage upload. Rejected:
- The API must read the whole file anyway to validate and convert it, so SAS saves nothing.
- It adds a SAS-issuing endpoint, storage-account CORS, and orphaned-upload cleanup.
- Azure Files' REST upload (4 MB ranges) is awkward from the browser.

At the expected sizes (tens of MB), an upload through the API takes seconds, far below the ingress request timeout (~240 s).

### D4: Exhaustive binary validation, block by block

The ingestion job opens the staged file with rasterio and rejects it with an actionable message if any of these fail:

1. It is not a readable GeoTIFF.
2. It does not have exactly one band.
3. The dtype is not an integer type. Float rasters are rejected.
4. There is no CRS.
5. Any pixel has a value outside {0, 1} ∪ {nodata}.

The value check reads the **whole** raster in fixed windows (for example 2048×2048). It does not use the file's native blocks, because strip layouts would make that one row per read. The job collects the set of distinct values. On failure it reports up to 10 offending values. If they fall within 1980–2100, it adds the hint "looks like loss-year values; binarize against the baseline before uploading". The nodata value is taken from the file. If the file declares none, the admin may provide one in the upload request (for example `?nodata=3`), and it is written into the COG. A raster with zero pixels equal to 1 is accepted, with a warning in the job result.

The job also reports the detected CRS, the dimensions, the bounds, and an approximate resolution in meters, as a hint for the manual `pixel_size` field. For projected CRSs this is the pixel size. For EPSG:4326 it is the degrees converted at the raster's centre latitude.

### D5: Normalize to COG, verify pixel equality, and swap atomically to a versioned filename

After validation, the job converts the raster with `rasterio.shutil.copy(..., driver="COG", compress="DEFLATE", predictor=2, blocksize=512, overview_resampling="nearest")` into `.staging/`, keeping the CRS and nodata. It then re-reads the original and the COG window by window and requires identical arrays. Only after that does it move the COG to `layers/rasters/<stem>-v<version>.tif`. `<stem>` is `layer-<id>` for new layers and the existing stem for seeded layers. The job then updates `raster_filename` and increments `version` in `index.json` (D6). Previous raster versions are kept on the share (they are small once converted to COG) for manual rollback. Staging files are always deleted when a job ends.

The spike confirmed this is also the only safe option on SMB: `os.replace` over a file that another handle has open fails *and deletes the target*, while `os.remove` of an open file is safe (the reader finishes). Raster files are therefore only ever created and, optionally, removed; they are never replaced. Removing old versions is safe even while a tile request still reads them.

Bit-packed inputs are promoted to 8-bit samples (`NBITS=8`), because the predictor needs whole bytes. `ecuador2.tif` is 2-bit, and exposed this in the end-to-end test with the real layers.

*Why versioned filenames instead of overwriting:*
- A tile request that is reading the old file never sees a partially written raster.
- Tile URLs change with `version`, which defeats the 1-day `Cache-Control` (D8).
- Rollback is a single `index.json` edit.

*Alternative considered:* storing the raster as uploaded. Rejected because of the measured 2.5–4 s low-zoom tiles (no overviews) and the 344 MB uncompressed file that becomes 0.6 MB.

### D6: Index model and atomic writes

`index.json` entries gain `enabled: bool` (default `true` when missing) and `version: int` (default `1` when missing), so existing files load without migration. New layers take `id = max(all ids) + 1`, and ids are never reused. New metadata files are named `layer-<id>.json` / `layer-<id>.md`. Edits to seeded layers write to their existing filenames.

All reads and writes of `index.json` and of the metadata files go through `LayerStore` and hold **one process-wide `threading.RLock`, readers included**. The spike showed that `os.replace` over a file that another handle has open fails with `EACCES` and leaves the target deleted once that handle closes. On this share, an unsynchronized reader would turn a normal index update into a lost index. With every reader and writer serialized inside the only process that touches the share (one uvicorn worker, one replica, `maxReplicas: 1`), no other handle is open during a replace.

A write goes to a temporary file in the same directory, is flushed and `fsync`ed, and is then moved with `os.replace`. As defense in depth, a `PermissionError` from `os.replace` triggers up to 10 retries with a 100 ms backoff. After a failed attempt the target may already be gone, and the retry then succeeds as a plain rename. The temporary file is kept until a read-back of the target matches. `LayerStore` also caches the parsed index in memory, keyed by the file's `mtime` and size, so most requests don't open `index.json` at all. Code on the share never calls `os.chmod`, `shutil.copy`, or `shutil.copystat` (they fail with `EPERM` on the cifs mount), only `shutil.copyfile`.

A new layer is created with `enabled: false` and can only be enabled once it has an ingested raster. Out-of-band edits to the share (the seed upload, a manual fix) must happen while the API is stopped or before it is pointed at the share.

A new layer is written with `raster_filename: null` and `version: 1`, so its first ingested raster becomes `layer-<id>-v2.tif`. Requests for the tiles or the image of a layer without a raster answer 404 instead of 500. Create, edit and enable/disable each run their read-modify-write of the index under `LayerStore.locked()`, so concurrent requests can't assign the same id. Years are stored as strings and integral pixel sizes as integers, matching the existing entries. The admin models forbid unknown fields, so a body that tries to set `enabled` or `version` through `PUT` is rejected with 422.

The attributes schema is unchanged (name, alias, coverage, source, resolution, contentDate, updateFrequency, publishDate). `name` and `alias` are required in both `en` and `es`. The rest is optional. Considerations are markdown, optional per language.

### D7: Background ingestion jobs, with job state persisted on the share

The upload handler responds `202` with a `jobId` once the body is fully staged. With a real server the job runs after that response, so the client always polls (the test client runs background tasks before returning, which hides this). Errors and warnings are `{code, message, params}` objects: `not_geotiff`, `band_count`, `not_integer`, `no_crs`, `not_binary`, `loss_years`, `conversion_mismatch`, `layer_not_found`, `interrupted`, `unexpected`; warnings `nodata_ignored` and `no_loss_pixels`. The UI translates them by code. It then schedules the ingestion (D4 and D5) with FastAPI `BackgroundTasks`, which runs in the thread pool. The job's state (`queued | running | succeeded | failed`, message, warnings, raster report) is written to `MAPS_ROOT/.jobs/<jobId>.json`. `GET /admin/jobs/{jobId}` returns it. Only one ingestion runs at a time: a second upload while another is running returns `409`. On startup, any job left `queued` or `running` is marked `failed` ("interrupted by restart") and its staging file is removed.

*Alternative considered:* synchronous conversion inside the request. Rejected: the spike measured 184 s for the worst current input (gfw, 55 MB strips) on 1 vCPU when processed on the share. Local processing (D3) should reduce that substantially, but it would still be too close to the ingress timeout. A queue service (Azure Queue Storage or Container Apps Jobs) is overkill for a single admin.

### D8: Public contract changes and cache invalidation

- `GET /maps` returns only enabled layers and adds `version` to `BaseMapData`.
- The frontend `MapData` gains `version: number`. `DeforestationMapOverlay.tsx` builds tile URLs as `.../tiles/{id}/dynamic/{z}/{x}/{y}.png?v={version}`. The API ignores the query parameter, so it is backward compatible.
- `POST /deforestation_analysis/analize`, the tiles endpoint, and `generate-image` keep resolving layers **by id regardless of `enabled`**, so sessions or reports created before a layer was disabled still work.

### D9: Shared-secret authentication with a stateless signed session token

- **Configuration:**
  - `ADMIN_PASSKEY_HASH`: lowercase hex SHA-256 of the passphrase. SHA-256 without a KDF is acceptable because the secret is high-entropy (≥ 64 characters, generated, not chosen by a person).
  - `ADMIN_SESSION_SECRET`: ≥ 32 random bytes, used to sign tokens.
  - `ADMIN_SESSION_TTL_MINUTES`: default 60.

  A small CLI (`uv run python -m app.modules.admin.passkey`) generates a random passphrase and prints it together with its hash, so nobody writes secrets by hand. If `ADMIN_PASSKEY_HASH` is unset, the admin routers are **not registered**: the routes return 404 and the OpenAPI docs don't show them.
- **Login:** `POST /admin/session` with `{ "passkey": "..." }`. The handler hashes the input and compares it with `hmac.compare_digest`. On success it returns `{ token, expiresAt }`. The token is `base64url(payload).base64url(HMAC-SHA256(payload))`, with payload `{iat, exp, jti}`, built from the standard library only. Rotating `ADMIN_SESSION_SECRET` invalidates all sessions, and rotating `ADMIN_PASSKEY_HASH` changes the login.
- **Authorization:** a `require_admin` FastAPI dependency validates `Authorization: Bearer <token>` (signature and `exp`) on every `/admin/*` route except the login. `GET /admin/session` returns the token's expiry, so the UI can check a stored token before using it.
- **App factory:** `app/main.py` builds the app in `create_app()`, which includes the admin router only when both secrets are set. `uvicorn app.main:app` is unchanged, and tests build apps with and without the admin.
- **Rate limit:** in memory, per client IP, 5 failed logins per 15 minutes, then `429` with `Retry-After`. The client IP is the last `X-Forwarded-For` hop, which the Container Apps ingress appends, falling back to the peer address. With one replica, in-memory state is enough. Every login attempt is logged (success or failure, IP, timestamp), and the passkey is never logged.
- **Frontend storage:** the token is kept in `sessionStorage` and cleared on logout or on expiry. The passphrase is never stored.

*Alternatives considered:*
- An httpOnly cookie. Rejected: front and API are on different sites (`azurecontainerapps.io` subdomains), so `SameSite=None` cookies would be needed.
- A Next.js BFF proxy that holds the secret. Rejected: it adds server routes and a second place where secrets live.
- Entra ID / Easy Auth. Rejected by the owner for now. It is documented as the upgrade path if per-person audit is needed.

### D10: CORS

The Bearer token is never attached automatically by the browser, so CORS is not the CSRF boundary. The global middleware is updated to `allow_methods=["GET","POST","PUT","PATCH"]`, `allow_headers` including `Authorization` and `Content-Type`, and `allow_credentials=False`, since cookies are not used. As defense in depth, when `ADMIN_ALLOWED_ORIGIN` is set, `require_admin` and the login route reject requests whose `Origin` header is present and different. Public routes keep `allow_origins=["*"]`.

### D11: Seeding the 6 existing layers

A CLI, `uv run python -m app.modules.layers.seed --source app/maps --target <dir>`, runs each existing raster through the same validation and COG pipeline as D4/D5, with pixel-equality verification. It writes `<stem>-v1.tif`, copies the metadata, and writes `index.json` with `enabled: true, version: 1`. The operator seeds into a local directory and uploads it to the share with `az storage file upload-batch`. The expected share size after seeding is under 100 MB.

A smoke check compares `POST /analize` ratios for a fixed sample of farms between the current production deployment and the share-backed deployment. They must be identical. The sample is the 10-farm regression set (`tests/regression/regression_farms.xlsx`), and the check is `uv run python -m tests.regression.parity <current-url> <candidate-url>`. It also compares parsed areas and validation results. The seed and admin ingestion share `app/modules/layers/processing.py` (validation, COG conversion, verification). Seeding the six current layers locally took about 3.5 minutes, left 51.8 MB, and gave identical parity against the Git-tracked layers.

### D12: Azure infrastructure

- **Storage:** resource group `monbo-data`, separate from the apps' resource group, so `./azure/deploy.sh destroy` (which deletes the app resource group) cannot delete layers. It contains:
  - A `CanNotDelete` management lock.
  - A StorageV2 `Standard_LRS` account, with TLS 1.2 minimum and public blob access disabled.
  - An SMB file share `maps` (quota 10 GiB), with share soft delete (14 days) and daily snapshots through Azure Backup for Files (30-day retention).
- **Mount:**
  - `az containerapp env storage set --storage-type AzureFile --access-mode ReadWrite` registers the share on the environment. It uses the account key; managed identity for Azure Files mounts is not relied upon.
  - The API app template declares a `volumes` entry (`storageType: AzureFile`, `mountOptions: uid=10001,gid=10001,dir_mode=0750,file_mode=0640`) and a `volumeMounts` entry at `/mnt/maps`. The spike validated exactly this form with uid/gid 999, the current `appuser`. `closetimeo` and similar cifs options are not accepted by Container Apps and are not needed. `az containerapp update` flags cannot add volumes, and `--yaml` is broken on az CLI 2.90 (see Spike results). `deploy.sh` therefore applies the API app with `az rest --method put` against `api-version=2024-03-01`, using a JSON body rendered from a template.
- **Dockerfile:** `Dockerfile.prod` pins `appuser` to uid/gid `10001`, so the mount options are deterministic.
- **Secrets:**
  - `ADMIN_PASSKEY_HASH` and `ADMIN_SESSION_SECRET` are Container App secrets referenced with `secretref:`.
  - `MAPS_ROOT` and `ADMIN_ALLOWED_ORIGIN` are plain environment variables. The frontend FQDN is computed ahead of time as `<front-app>.<environment defaultDomain>`, so the API can be configured before the front is deployed.
  - The passphrase itself goes into the team's password manager, never into Azure.

### D13: Admin UI

- **Pages:** new client pages under `src/app/[locale]/admin/layers/`:
  - `page.tsx`: the list, with status, version, and an enable/disable toggle.
  - `new/page.tsx` and `[id]/page.tsx`: the form for the index fields; en/es tabs for the attributes and considerations with a `react-markdown` preview; and the raster upload with `react-dropzone`, a progress bar, and polling of job status with the job report.
- **Login:** `src/app/[locale]/admin/page.tsx`.
- **State and API:** an `AdminSessionContext` holds the token. `src/api/adminLayers.ts` holds the calls. TypeScript interfaces mirror the Pydantic admin models.
- **Translations and navigation:** a new `admin` translation namespace in `src/locales/{en,es}/admin.json`. There are no links from the home page or the header.
- **As built:** `src/app/[locale]/admin/layout.tsx` loads the `admin` namespace and the `AdminSessionProvider` for every admin page and marks them `noindex`. The session context validates a stored token on load (`GET /admin/session`), signs out when the token expires, and sends any 401 back to the login. The job's `status` is polled every 1.5 s while the raster section is open. Ingestion errors and warnings are translated by `code`, with the API's English message as fallback. The form uses react-hook-form (`useForm` with `reValidateMode: "onChange"`, `useFieldArray` for references, `Controller` for the country picker, `useWatch` for the Markdown preview). Its rules mirror the API's validation and return translation keys, and errors appear on the first save attempt and follow every edit after that. The language tabs stay mounted (`ClassicTabs keepMounted`), so the tab that was never opened is still validated. An end-to-end browser run (Playwright over the dev server and a live API) covered login, the layer list, creating a layer, a rejected loss-year raster, ingesting the real `ecuador2.tif`, publishing, and the English UI.

### D14: Local development

`MAPS_ROOT` defaults to `app/maps`, the files tracked in Git. If the admin is enabled while `MAPS_ROOT` resolves inside the repository, the API logs a startup warning ("admin writes will modify Git-tracked files"). The onboarding docs recommend copying `app/maps` to a gitignored `monbo-api/.local-maps/` and pointing `MAPS_ROOT` there when working on the admin.

## Risks / Trade-offs

- **[SMB permissions]** ~~The non-root user may be unable to write.~~ Resolved by the spike: explicit `uid/gid` mount options give the app user ownership with `0750/0640`. `chmod` is not permitted on the mount, so the code must use `shutil.copyfile` and never `shutil.copy`/`copystat`.
- **[Tile latency over SMB]** ~~Reads over Azure Files may be too slow.~~ Resolved by the spike: COG on SMB gives p95 ≤ 60 ms (cold first tile ≤ 142 ms), versus a target of 300 ms.
- **[Replace over an open file deletes it (SMB)]** An `os.replace` that races with any open handle on the target fails and loses the target. → One `RLock` around every index and metadata read and write, a single API process, an in-memory index cache, retry-with-read-back on `PermissionError` (D6), and rasters that are never replaced (D5). A unit test simulates `PermissionError` on the first replace and asserts the index survives.
- **[Conversion time on 1 vCPU]** Large inputs may take minutes. → The job runs in the background (D7) with only one ingestion at a time. The upload cap limits the worst case.
- **[Concurrent writes if scaled]** The in-memory lock and rate limiter assume one replica. → The infrastructure pins `maxReplicas: 1` and the design documents the constraint. Scaling out requires moving the lock and the limiter to shared storage first.
- **[Shared secret]** Anyone with the passphrase is "the admin", with no per-person audit, and a leaked passphrase grants full admin. → High entropy, a stored hash, short sessions, rate limiting, logged attempts, and a documented rotation procedure (regenerate, update the secret, new revision). Entra ID is the upgrade path.
- **[Token in `sessionStorage`]** An XSS could read it. → The TTL is short, the app renders no user-supplied HTML (markdown through `react-markdown`, which does not render raw HTML by default), and the only third-party script is Google Maps.
- **[The share becomes the only copy]** Once Git layers are removed, the share is authoritative. → Separate locked resource group, share soft delete, and daily snapshots. The Git copy remains until `remove-layers-from-git`.
- **[`deploy.sh` switching to `--yaml` for the API]** A YAML that omits the volume would silently unmount it, and the app would fall back to the image files. → The YAML is the single template that `deploy.sh` renders. `/health` reports `mapsRoot` and whether it is writable, and `deploy.sh` checks it after deploying.
- **[Stale browser tiles]** → `?v=version` in tile URLs (D8).

## Migration Plan

1. **Spike:** create the storage resource group, account, and share. Mount the share in a test revision and validate permissions, `os.replace`, and tile latency with a COG.
2. **Merge the code with `MAPS_ROOT` unset.** Behavior stays identical, since the API reads `app/maps` from the image and the admin is disabled without `ADMIN_PASSKEY_HASH`.
3. **Seed:** run the seed CLI locally, upload to the share, and verify the file listing.
4. **Deploy** with the mount, `MAPS_ROOT=/mnt/maps`, and the admin secrets. Verify `/health` (`mapsRoot`, writable), `GET /maps` (6 layers), the analysis smoke check (identical ratios), tiles at z=6 and z=12, and image generation.
5. **Exercise the admin in production:** create a test layer, upload a raster, enable it, then disable it. Edit metadata on a seeded layer.

**Rollback:** remove `MAPS_ROOT` (or the mount) and deploy a new revision. The API goes back to reading the image's `app/maps`, and admin changes are paused but remain on the share. This rollback path exists until `remove-layers-from-git` is applied.

## Open Questions

- ~~The exact `mountOptions`~~ Resolved: `uid=<appuser>,gid=<appuser>,dir_mode=0750,file_mode=0640`.
- ~~Tile latency over SMB with COG~~ Resolved: p95 ≤ 60 ms at z=6–14.
- ~~Ephemeral storage quota~~ Resolved: Container Apps gives a replica with ≤ 1 vCPU 4 GiB of ephemeral storage in total, enough for a 500 MB upload plus its COG.
- The retention policy for old raster versions on the share. The current plan keeps them all; revisit if the share grows.
