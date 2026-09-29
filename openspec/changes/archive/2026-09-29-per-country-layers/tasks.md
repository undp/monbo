## 0. Prerequisite

- [ ] 0.1 Confirm `country-first-flow` is merged and deployed (the frontend selects one country and uses `useAvailableCountries`)

## 1. Per-country storage

- [x] 1.1 Teach `LayerStore` to detect the layout: per-country (`countries.json`), legacy flat (top-level `index.json`), or invalid (both → startup error naming the files; neither counts as a flat root without an index, as before)
- [x] 1.2 Add country-scoped paths (`<CC>/index.json`, metadata, rasters) with strict ISO alpha-2 validation of folder names, and reuse the existing atomic write, retry, and lock code for each country's files
- [x] 1.3 Add the registry reader (`countries.json`, cached by mtime and size, keeping the last valid copy and logging an error on parse failures) and an atomic registry writer used only by the CLI
- [x] 1.4 Tag every layer with its country (`LayersRoot.layers()`), and find layers by country and id (`find_layer`, `is_layer`). New ids come from the country's own index (design D6, reworked: ids numbered within each country)
- [x] 1.5 Rewrite `get_all_maps`, `get_map_by_id` and the raster and metadata helpers on top of the country-aware store. In legacy mode, keep today's behavior and filter by `available_countries_codes`
- [x] 1.6 Add the `country` query parameter to `GET /maps`. Return `availableCountriesCodes: [country]` in the per-country layout
- [x] 1.7 Add a public `GET /countries` router (enabled countries with at least one enabled layer; in legacy mode, the union of the codes of enabled layers)
- [x] 1.8 Tests: layout detection and startup errors, country paths, registry caching and a corrupted registry, ids numbered within each country, analysis, tiles and `generate-image` by country and id (including the 422 without a country and the same id in two countries), the `/maps` filter (known, unknown and disabled country), `/countries` in both modes, and legacy mode against the Git-tracked `app/maps`. Confirm the regression and parity suites stay green on the legacy root

- [x] 1.9 Take the country in `POST /analize` and `POST /generate-image` (body) and in the tiles path (`/tiles/{country}/{id}/…`): 422 without it in the per-country layout, optional with a flat root

## 2. Country registry CLI

- [x] 2.1 Create `app/modules/admin/countries.py` with `add`, `list`, `rotate`, `disable` and `enable`, and `--root` defaulting to `MAPS_ROOT` (it loads the API's configuration like the other commands: `app/modules/__init__.py` imports every router)
- [x] 2.2 `add` validates the code with `pycountry`, refuses existing codes, scaffolds the folder with an empty `index.json`, registers the country, and prints the passkey once. `rotate` replaces the hash and prints the new passkey
- [x] 2.3 Remove `app/modules/admin/passkey.py` and update the references to it in the docs and in `deploy.sh`
- [x] 2.4 Tests for every scenario in `specs/country-registry/spec.md` that covers the CLI, using a temporary root. Assert that no passkey is written to disk or logged

## 3. Per-country admin authentication

- [x] 3.1 Drop `ADMIN_PASSKEY_HASH` from `env.py`, and log a startup warning when it is still set. `admin_enabled()` becomes: `ADMIN_SESSION_SECRET` is set and the layout is per-country, with a warning for the legacy layout
- [x] 3.2 Replace `passkey_matches` with a constant-time scan over the enabled countries' hashes that returns the matching country or none, without stopping early
- [x] 3.3 Add `country` and `kid` (the first 16 hex characters of the hash) to the token claims. `require_admin` checks the signature, the expiry, that the country is registered and enabled, and that `kid` matches the current hash, and returns a `Session` with `country`
- [x] 3.4 Return `country` from `POST /admin/session` and `GET /admin/session`. Log the country on successful logins
- [x] 3.5 Tests: login per country, disabled country returns 401, rotation and disable invalidate existing tokens, tokens without `country` are rejected, routes absent on a legacy root, the leftover `ADMIN_PASSKEY_HASH` warning, and rate limiting and origin checks unchanged

## 4. Admin scoped to the session's country

- [x] 4.1 Remove `available_countries_codes` from the admin Pydantic models and from `_apply_input` and `_to_admin_layer`
- [x] 4.2 Scope `GET/POST /admin/layers` and `PUT/PATCH /admin/layers/{id}` to `session.country`. Another country's id returns 404. Creation takes the country's highest id + 1 and writes into the country folder
- [x] 4.3 Scope `PUT /admin/layers/{id}/raster` and ingestion: rasters go to `<CC>/layers/rasters/`, jobs record `country` and `layer_id`, `GET /admin/jobs/{id}` returns 404 across countries, and the global single-job 409 does not name the other country
- [x] 4.4 Tests for every scenario in the `layer-administration` and `raster-ingestion` delta specs, with two countries in a temporary root

## 5. Migration

- [x] 5.1 Create `app/modules/layers/migrate_countries.py` (`--source`, `--target`), following design D8: refuse a non-empty target or a non-flat source, number each country's layers from 0 in the order of their original ids, write the id mapping with `--mapping-out`, copy with `shutil.copyfile`, register the countries, and print the passkeys and the id mapping
- [x] 5.2 Test with small fixture rasters: the id mapping for a flat index shaped like today's, metadata copied per country, `available_countries_codes` dropped, and a non-empty target refused
- [x] 5.3 Add a parity test that migrates the regression fixture layers (sparse copies of `app/maps` that run in CI) to a temp dir and analyzes the regression farm sample. Every country's new ids must match their old ids on the flat root (`parity.compare_migrated` with the migration's mapping)

## 6. Frontend

- [x] 6.1 Add `getCountries()` in `src/api` and switch `useAvailableCountries` to `GET /countries`
- [x] 6.2 Make `getMaps` send `country=<selectedCountry>` when one is selected, and refetch when the country changes
- [x] 6.3 Remove `available_countries_codes` from `AdminLayer`/`LayerInput` in `interfaces/AdminLayer.ts`, the countries field and validator in `LayerForm.tsx`, the countries column in `AdminLayersPageContent.tsx`, and the unused `admin.json` keys
- [x] 6.4 Store `country` from the session response in the admin session context and show the country's name in `AdminPageContainer` (en/es)

- [x] 6.5 Send the selected country in `analizeDeforestation`, `generatePolygonDeforestationImage` (via `fetchDeforestationImages`) and the tile URLs of `DeforestationMapOverlay`

## 7. Azure and docs

- [x] 7.1 `render_api_app.py`: keep `MAPS_ROOT=/mnt/maps` (per-country layout at the share's root), and drop the `admin-passkey-hash` secret and env var
- [x] 7.2 `deploy.sh`: replace `share_has_index` with a check for `countries.json`, and drop `ADMIN_PASSKEY_HASH`
- [x] 7.3 `deploy.sh countries <add|list|rotate|disable|enable> [CC]`: download `countries.json` with its ETag, run the CLI on a temp root, check the ETag, and upload the registry and any new folder skeleton
- [x] 7.4 `deploy.sh seed`: confirm with the share's name when it has files; seed and split locally; then empty the share and upload the per-country layout to its root; write the id mapping for `parity --mapping`. Document it in `docs/suggested_deployment.md` (first setup, starting over, rollback). Replaces the in-place migration to `v2/`: only dev had a share
- [x] 7.5 Document for operators how to add, rotate and disable a country, and for admins that copied layers (GFW, TMF) are independent per country

## 8. Rollout

- [x] 8.1 Development: `./azure/deploy.sh seed` (confirm the share name), store the three passkeys in the password manager, and deploy this release with `ADMIN_SESSION_SECRET`
- [x] 8.2 Optionally check parity against the Git layers (`tests.regression.parity --mapping /tmp/monbo-seed-ids.json`)
- [x] 8.3 Smoke test: each country admin sees only their own layers, an analysis in each country works, and `GET /countries` returns CO, CR and EC
- [ ] 8.4 Production: `storage`, `seed`, deploy; hand each passkey to its country admin
