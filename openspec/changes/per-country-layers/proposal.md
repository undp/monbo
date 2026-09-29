## Why

After `country-first-flow`, every analysis belongs to one country, but layers are still one shared list with a single admin. Whoever holds the passkey can edit any country's layers, and a layer tagged with several countries (GFW, TMF) can't be updated for one country without changing it for the others. The team wants each country to manage its own layers with its own admin, and wants adding a country to be a single operator command instead of a code change and a redeploy.

## What Changes

- **BREAKING (storage layout)**: layers are stored in **one folder per country** under `MAPS_ROOT` (`<CC>/index.json`, `<CC>/metadata/...`, `<CC>/layers/rasters/`). Each layer belongs to exactly one country, and `available_countries_codes` is dropped from index entries and from the admin contracts.
- New **country registry** `MAPS_ROOT/countries.json`: for each country, its code, the SHA-256 of its admin passkey, and whether it is enabled. It is managed by a new CLI (`add`, `list`, `rotate`, `disable`, `enable`) that works on any maps root, and it is picked up by the running API without a redeploy or restart. `azure/deploy.sh` gains commands that run it against the Azure share.
- **BREAKING (admin auth)**: `ADMIN_PASSKEY_HASH` is replaced by **one passkey per country**, taken from the registry. The login finds the country from the passkey alone. The session token carries the country and a fingerprint of the passkey, so rotating or disabling a country ends its sessions immediately. `ADMIN_SESSION_SECRET` stays a single environment secret.
- Admin routes act only on the **admin's own country**: its layers, rasters and ingestion jobs. Another country's layer or job answers 404. New layers are created in the admin's country, and the form no longer asks for countries.
- **Layer ids stay globally unique** across countries, so analysis, tiles and image generation keep resolving a layer by id alone and their URLs don't change. The six existing layers keep their ids.
- **Migration command** that turns the current flat layout into the per-country one. Single-country layers move with their id; GFW and TMF are copied whole (not clipped) into EC, CO and CR, with the original id kept by the first country listed and new ids for the copies. The command prints one passkey per country.
- In Azure the new layout goes to **`/mnt/maps/v2`** on the same share. The flat layout at the share root stays untouched as the rollback path.
- New public **`GET /countries`**: the countries that are enabled and have at least one enabled layer. `GET /maps` gains an optional `country` filter. The landing page and the header selector from `country-first-flow` read `GET /countries`.
- A root with the **legacy flat layout** (such as the Git-tracked `app/maps` used locally and by open-source deployments) is still served, read-only: public routes work, with countries derived from `available_countries_codes`, and the admin routes are not registered.

## Capabilities

### New Capabilities
- `country-registry`: which countries exist and who administers them. Covers `countries.json` (code, passkey hash, enabled), the operator CLI (`add`, `list`, `rotate`, `disable`, `enable`) and its scaffolding of a country folder, how the running API picks up registry changes, a country's lifecycle (created → with layers → published → disabled), and the public `GET /countries`.

### Modified Capabilities
- `layer-storage`: the layout becomes one folder per country plus the registry. Layer ids are unique across countries, lookup by id spans every country, `GET /maps` gains the `country` filter, and a legacy flat root is served read-only.
- `admin-authentication`: the admin feature depends on `ADMIN_SESSION_SECRET` and a per-country root instead of `ADMIN_PASSKEY_HASH`. Passkeys are per country, the token carries the country and a passkey fingerprint that is checked on every call, and the login and session responses include the country.
- `layer-administration`: listing, creating, editing and enabling are scoped to the admin's country. `available_countries_codes` is removed, and the admin UI shows the admin's country and drops the countries field.
- `raster-ingestion`: uploads and job status are scoped to the admin's country, and ingestion is still one job at a time across all countries.
- `layer-storage-infrastructure`: the API mounts the per-country layout at `/mnt/maps/v2`. `ADMIN_PASSKEY_HASH` is no longer a secret, the deploy check looks for `countries.json`, and there is a migration procedure, country commands in `deploy.sh`, and a rollback path to the flat layout.

## Impact

- **API (`monbo-api`)**:
  - `LayerStore` learns the per-country layout, a global id → country map, the registry, and legacy read-only detection.
  - New `app/modules/admin/countries.py` CLI.
  - New `app/modules/layers/migrate_countries.py`.
  - `auth.py`: the token gains `country` and `kid` claims, and `passkey_matches` is replaced by a registry lookup.
  - Admin layers, rasters and jobs are scoped by the session's country.
  - New `GET /countries` router, and the `country` filter on `GET /maps`.
  - `env.py` drops `ADMIN_PASSKEY_HASH`, and `passkey.py` is folded into the CLI.
  - Tests for every scenario, plus analysis parity after migration.
- **Frontend (`monbo-front`)**:
  - `useAvailableCountries` calls `GET /countries`, and `getMaps` sends the selected country.
  - Admin: `AdminLayer` and `LayerInput` lose `available_countries_codes`, the countries field and column go away, and the session shows the admin's country.
  - The login page is unchanged (passkey only).
- **Azure**:
  - `render_api_app.py` sets `MAPS_ROOT=/mnt/maps/v2` and drops the `admin-passkey-hash` secret.
  - `deploy.sh` checks for `v2/countries.json` and gains `countries <add|list|rotate|disable|enable>` subcommands that work on the share with `az storage`.
  - `docs/suggested_deployment.md` documents the migration and how to add a country.
- **Storage**: about 200 MB more on the share (GFW and TMF, twice each).
- **Depends on** `country-first-flow` being deployed first.
