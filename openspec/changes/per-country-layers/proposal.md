## Why

After `country-first-flow`, every analysis belongs to one country, but layers are still one shared list with a single admin. Whoever holds the passkey can edit any country's layers, and a layer tagged with several countries (GFW, TMF) can't be updated for one country without changing it for the others. The team wants each country to manage its own layers with its own admin, and wants adding a country to be a single operator command instead of a code change and a redeploy.

## What Changes

- **BREAKING (storage layout)**: layers are stored in **one folder per country** under `MAPS_ROOT` (`<CC>/index.json`, `<CC>/metadata/...`, `<CC>/layers/rasters/`). Each layer belongs to exactly one country, and `available_countries_codes` is dropped from index entries and from the admin contracts.
- New **country registry** `MAPS_ROOT/countries.json`: for each country, its code, the SHA-256 of its admin passkey, and whether it is enabled. It is managed by a new CLI (`add`, `list`, `rotate`, `disable`, `enable`) that works on any maps root, and it is picked up by the running API without a redeploy or restart. `azure/deploy.sh` gains commands that run it against the Azure share.
- **BREAKING (admin auth)**: `ADMIN_PASSKEY_HASH` is replaced by **one passkey per country**, taken from the registry. The login finds the country from the passkey alone. The session token carries the country and a fingerprint of the passkey, so rotating or disabling a country ends its sessions immediately. `ADMIN_SESSION_SECRET` stays a single environment secret.
- Admin routes act only on the **admin's own country**: its layers, rasters and ingestion jobs. Another country's layer or job answers 404. New layers are created in the admin's country, and the form no longer asks for countries.
- **Each country numbers its layers from 0.** A layer is identified by its country and its id. Creating a layer only reads that country's index.
- **BREAKING (public API):** `POST /deforestation_analysis/analize` and `POST /deforestation_analysis/generate-image` take a `country` in the body, and tiles move to `/deforestation_analysis/tiles/{country}/{id}/…`. With a flat root, the country is optional.
- **Migration command** that turns the current flat layout into the per-country one. Each layer goes to every country it lists, so GFW and TMF are copied whole (not clipped) into EC, CO and CR, and each country numbers its layers from 0. The command prints one passkey per country and can write the old id → new id mapping, which `tests.regression.parity --mapping` uses to compare both layouts.
- In Azure the per-country layout lives at the share's root, **`/mnt/maps`**. The share had only been filled in the development environment, and production has none yet. So there is no in-place migration: the new **`./azure/deploy.sh seed`** fills a share from the Git-tracked layers (seed, then per-country split). On a share with files it first asks for confirmation and empties it. That covers both starting dev over and the first production setup.
- New public **`GET /countries`**: the countries that are enabled and have at least one enabled layer. `GET /maps` gains an optional `country` filter. The landing page and the header selector from `country-first-flow` read `GET /countries`.
- A root with the **legacy flat layout** (such as the Git-tracked `app/maps` used locally and by open-source deployments) is still served, read-only: public routes work, with countries derived from `available_countries_codes`, and the admin routes are not registered.

## Capabilities

### New Capabilities
- `country-registry`: which countries exist and who administers them. Covers `countries.json` (code, passkey hash, enabled), the operator CLI (`add`, `list`, `rotate`, `disable`, `enable`) and its scaffolding of a country folder, how the running API picks up registry changes, a country's lifecycle (created → with layers → published → disabled), and the public `GET /countries`.

### Modified Capabilities
- `layer-storage`: the layout becomes one folder per country plus the registry. Ids are numbered within each country, and layers are found by country and id (analysis, tiles and image generation take the country). `GET /maps` gains the `country` filter, and a legacy flat root is served read-only.
- `admin-authentication`: the admin feature depends on `ADMIN_SESSION_SECRET` and a per-country root instead of `ADMIN_PASSKEY_HASH`. Passkeys are per country, the token carries the country and a passkey fingerprint that is checked on every call, and the login and session responses include the country.
- `layer-administration`: listing, creating, editing and enabling are scoped to the admin's country. `available_countries_codes` is removed, and the admin UI shows the admin's country and drops the countries field.
- `raster-ingestion`: uploads and job status are scoped to the admin's country, and ingestion is still one job at a time across all countries.
- `layer-storage-infrastructure`: the share holds the per-country layout at `/mnt/maps`. `ADMIN_PASSKEY_HASH` is no longer a secret, and the deploy check looks for `countries.json`. `deploy.sh` gains `seed` (fill or refill the share from Git) and `countries`, and a rollback to an earlier release restores the share from a snapshot.

## Impact

- **API (`monbo-api`)**:
  - A new `LayersRoot` over `LayerStore` knows the per-country layout, the registry, lookups by country and id, and legacy read-only detection.
  - `/analize` and `/generate-image` take `country` in the body; tiles move to `/tiles/{country}/{id}/…`.
  - New `app/modules/admin/countries.py` CLI.
  - New `app/modules/layers/migrate_countries.py`.
  - `auth.py`: the token gains `country` and `kid` claims, and `passkey_matches` is replaced by a registry lookup.
  - Admin layers, rasters and jobs are scoped by the session's country.
  - New `GET /countries` router, and the `country` filter on `GET /maps`.
  - `env.py` drops `ADMIN_PASSKEY_HASH`, and `passkey.py` is folded into the CLI.
  - Tests for every scenario, plus analysis parity after migration.
- **Frontend (`monbo-front`)**:
  - `useAvailableCountries` calls `GET /countries`, and `getMaps`, the analysis, the report images and the tile URLs send the selected country.
  - Admin: `AdminLayer` and `LayerInput` lose `available_countries_codes`, the countries field and column go away, and the session shows the admin's country.
  - The login page is unchanged (passkey only).
- **Azure**:
  - `render_api_app.py` drops the `admin-passkey-hash` secret (`MAPS_ROOT` stays `/mnt/maps`).
  - `deploy.sh` checks for `countries.json` and gains `seed` and `countries <add|list|rotate|disable|enable>` subcommands that work on the share with `az storage`.
  - The development share is emptied and seeded again; its admin edits are dropped (they can be recovered from a snapshot).
  - `docs/suggested_deployment.md` documents the migration and how to add a country.
- **Storage**: about 200 MB more on the share (GFW and TMF, twice each).
- **Depends on** `country-first-flow` being deployed first.
