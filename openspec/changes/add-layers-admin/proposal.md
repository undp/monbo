## Why

Deforestation layers are files baked into the API Docker image (`app/maps/index.json`, per-language metadata, and ~511 MB of Git LFS rasters). Adding or updating a layer requires a commit, an LFS push, an image rebuild, and a redeploy, and the Azure Container App's filesystem is ephemeral, so nothing can be edited at runtime. The team wants an admin to add and modify layers from the app itself. Measurements taken during exploration also showed that none of the current rasters are Cloud Optimized GeoTIFFs (no overviews, three strip-organized, one uncompressed at 344 MB). As a result, a country-level tile costs 2.5–4 s to render, versus 3–80 ms for the same data as a COG.

## What Changes

- Add a **layers admin** ("mantenedor de capas"): an admin can list all layers (including disabled ones), create a layer, edit its index fields and its bilingual (en/es) attributes and considerations, replace its raster, and enable/disable it. Layers are never hard-deleted and ids are never reused.
- Add **admin authentication** with a single long shared secret. The API stores only a SHA-256 hash of the secret. Login exchanges the secret for a short-lived signed session token sent as `Authorization: Bearer`. Failed attempts are rate-limited and logged. The whole admin surface is disabled (routes not registered) when no secret hash is configured, so open-source deployments keep today's behavior.
- Introduce a **configurable layer storage root** (`MAPS_ROOT`, default `app/maps`) behind a single `LayerStore` module. In Azure it points to an **Azure Files share mounted at `/mnt/maps`**, which becomes the single source of truth for layers.
- Add a **raster ingestion pipeline** for uploads through the API:
  - Staging on the share, then a background job.
  - Structural checks (GeoTIFF, single band, integer dtype, CRS present).
  - **Exhaustive block-by-block binary check**: values ⊆ {0, 1, nodata}, with an explicit error when year-like values indicate an unprocessed layer.
  - Conversion to **COG** (DEFLATE, nearest-neighbour overviews), followed by pixel-equality verification against the original.
  - An atomic swap to a **versioned filename**.
  - Job status that the client polls.
- **Invalidate tile caches** by adding a layer `version`. The public maps response exposes it and the frontend appends it to tile URLs.
- The public `GET /maps` returns **only enabled layers**. Analysis, tiles, and image generation keep resolving by id, including disabled layers, so existing sessions and reports don't break.
- Add an **admin UI** in the Next.js frontend under `/[locale]/admin/layers`: login, list, create/edit form with a markdown preview for considerations, raster upload with progress and job status. en/es translations. The public home page does not link to it.
- Extend CORS to the methods the admin routes need, and restrict admin routes to the configured frontend origin.
- Add **Azure infrastructure** for layer storage:
  - A Storage Account in a dedicated resource group protected by a `CanNotDelete` lock.
  - An Azure Files share with soft delete and scheduled snapshots.
  - Container Apps environment storage, plus a volume mount on the API app with `uid/gid` mount options.
  - Admin secrets as Container App secrets.
  - `azure/deploy.sh` support for the mount.
- Add a **seed procedure** that runs the 6 existing layers through the same COG pipeline and loads them into the share. After seeding, the share, not Git, is authoritative.
- Removing layers from Git is **out of scope**. It is a separate follow-up change (`remove-layers-from-git`), applied only after this change is running in production.

## Capabilities

### New Capabilities
- `layer-storage`: where layers live and how they are resolved at runtime. Covers the configurable `MAPS_ROOT`, the on-disk layout, atomic writes to the index, versioned raster filenames, enabled/disabled layers, and the public maps listing (enabled only, with `version`).
- `admin-authentication`: shared-secret admin login, stored as a hash. Covers the short-lived signed session token, Bearer authorization on admin routes, rate limiting and logging of attempts, disabling the feature when unconfigured, and CORS restrictions for admin routes.
- `layer-administration`: the admin API and admin UI for listing, creating, editing (index fields plus en/es attributes and considerations), and enabling/disabling layers, with Pydantic ↔ TypeScript contracts.
- `raster-ingestion`: raster upload through the API. Covers staging, structural and exhaustive binary validation, COG conversion with pixel-equality verification, versioned atomic swap, background job status, and actionable error messages.
- `layer-storage-infrastructure`: Azure resources and deployment for persistent layer storage. Covers the Storage Account in its own locked resource group, the Azure Files share with soft delete and snapshots, the Container Apps volume mount, admin secrets, the deploy script changes, and the seed procedure for existing layers.

### Modified Capabilities
<!-- None. Existing specs (CI, toolchains, orchestration, Dependabot) do not change at requirement level. -->

## Impact

- **API (`monbo-api`)**:
  - New `app/modules/admin/` (auth, layers router, ingestion jobs) and a `LayerStore` replacing the direct paths in `app/modules/maps/helpers.py` and `app/utils/maps.py`.
  - `app/config/env.py` gains `MAPS_ROOT`, `ADMIN_PASSKEY_HASH`, `ADMIN_SESSION_SECRET`, and `ADMIN_ALLOWED_ORIGIN`.
  - `app/main.py` changes CORS and registers the admin routes conditionally.
  - `app/models/maps.py` gains `version` and `enabled`.
  - New tests with small fixture rasters. The numeric baseline must stay unchanged.
- **Frontend (`monbo-front`)**:
  - New `src/app/[locale]/admin/layers/**` pages, `src/api/adminLayers.ts`, and admin components.
  - New `admin.json` locale files (en/es).
  - `MapData` gains `version`, and `DeforestationMapOverlay.tsx` appends it to tile URLs.
- **Data contract**: `index.json` entries gain `enabled` (default `true`) and `version` (default `1`). Existing entries stay readable without migration.
- **Dependencies**: likely none new in the API. COG conversion uses the rasterio/GDAL already bundled, and the session token can be an HMAC built from the standard library. No new heavy dependencies in the frontend (`react-markdown` and `react-dropzone` already exist).
- **Azure**:
  - New Storage Account and file share in a separate resource group.
  - Container Apps environment storage definition and a volume mount on `monbo-api`.
  - New secrets.
  - `azure/deploy.sh` and `azure/monbo-api-app.yml` updated.
  - API sizing stays at 1 CPU / 2 GiB, as `deploy.sh` defaults already set.
- **Docs**: `docs/maps.md` (the admin is now the way to manage layers), `docs/suggested_deployment.md` (storage and secrets), `docs/onboarding.md` (local `MAPS_ROOT`).
- **Risks**:
  - SMB permissions for the non-root `appuser`.
  - COG conversion time on 1 vCPU for the largest inputs.
  - Concurrent writes if replicas are ever scaled above 1.
  - The shared secret gives every admin the same identity, so there is no per-person audit trail.
