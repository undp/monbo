## 0. Prerequisite

- [ ] 0.1 Confirm `country-first-flow` is merged and deployed (the frontend selects one country and uses `useAvailableCountries`)

## 1. Per-country storage

- [ ] 1.1 Teach `LayerStore` to detect the layout: per-country (`countries.json`), legacy flat (top-level `index.json`), or invalid (both or neither → startup error naming the files)
- [ ] 1.2 Add country-scoped paths (`<CC>/index.json`, metadata, rasters) with strict ISO alpha-2 validation of folder names, and reuse the existing atomic write, retry, and lock code for each country's files
- [ ] 1.3 Add the registry reader (`countries.json`, cached by mtime and size, keeping the last valid copy and logging an error on parse failures) and an atomic registry writer used only by the CLI
- [ ] 1.4 Add the global id → country map built from every country's index, and `next_layer_id()` (the max across countries, under the lock)
- [ ] 1.5 Rewrite `get_all_maps`, `get_map_by_id` and the raster and metadata helpers on top of the country-aware store. In legacy mode, keep today's behavior and filter by `available_countries_codes`
- [ ] 1.6 Add the `country` query parameter to `GET /maps`. Return `availableCountriesCodes: [country]` in the per-country layout
- [ ] 1.7 Add a public `GET /countries` router (enabled countries with at least one enabled layer; in legacy mode, the union of the codes of enabled layers)
- [ ] 1.8 Tests: layout detection and startup errors, country paths, registry caching and a corrupted registry, a unique id across countries, analysis, tiles and `generate-image` by id for a copied layer, the `/maps` filter (known, unknown and disabled country), `/countries` in both modes, and legacy mode against the Git-tracked `app/maps`. Confirm the regression and parity suites stay green on the legacy root

## 2. Country registry CLI

- [ ] 2.1 Create `app/modules/admin/countries.py` with `add`, `list`, `rotate`, `disable` and `enable`, and `--root` defaulting to `MAPS_ROOT`. It must not import `app.config.env`
- [ ] 2.2 `add` validates the code with `pycountry`, refuses existing codes, scaffolds the folder with an empty `index.json`, registers the country, and prints the passkey once. `rotate` replaces the hash and prints the new passkey
- [ ] 2.3 Remove `app/modules/admin/passkey.py` and update the references to it in the docs and in `deploy.sh`
- [ ] 2.4 Tests for every scenario in `specs/country-registry/spec.md` that covers the CLI, using a temporary root. Assert that no passkey is written to disk or logged

## 3. Per-country admin authentication

- [ ] 3.1 Drop `ADMIN_PASSKEY_HASH` from `env.py`, and log a startup warning when it is still set. `admin_enabled()` becomes: `ADMIN_SESSION_SECRET` is set and the layout is per-country, with a warning for the legacy layout
- [ ] 3.2 Replace `passkey_matches` with a constant-time scan over the enabled countries' hashes that returns the matching country or none, without stopping early
- [ ] 3.3 Add `country` and `kid` (the first 16 hex characters of the hash) to the token claims. `require_admin` checks the signature, the expiry, that the country is registered and enabled, and that `kid` matches the current hash, and returns a `Session` with `country`
- [ ] 3.4 Return `country` from `POST /admin/session` and `GET /admin/session`. Log the country on successful logins
- [ ] 3.5 Tests: login per country, disabled country returns 401, rotation and disable invalidate existing tokens, tokens without `country` are rejected, routes absent on a legacy root, the leftover `ADMIN_PASSKEY_HASH` warning, and rate limiting and origin checks unchanged

## 4. Admin scoped to the session's country

- [ ] 4.1 Remove `available_countries_codes` from the admin Pydantic models and from `_apply_input` and `_to_admin_layer`
- [ ] 4.2 Scope `GET/POST /admin/layers` and `PUT/PATCH /admin/layers/{id}` to `session.country`. Another country's id returns 404. Creation uses `next_layer_id()` and writes into the country folder
- [ ] 4.3 Scope `PUT /admin/layers/{id}/raster` and ingestion: rasters go to `<CC>/layers/rasters/`, jobs record `country` and `layer_id`, `GET /admin/jobs/{id}` returns 404 across countries, and the global single-job 409 does not name the other country
- [ ] 4.4 Tests for every scenario in the `layer-administration` and `raster-ingestion` delta specs, with two countries in a temporary root

## 5. Migration

- [ ] 5.1 Create `app/modules/layers/migrate_countries.py` (`--source`, `--target`), following design D8: refuse a non-empty target or a non-flat source, keep the id for the first listed country and assign new ids for copies in order, copy with `shutil.copyfile`, register the countries, and print the passkeys and the id mapping
- [ ] 5.2 Test with small fixture rasters: the id mapping for a flat index shaped like today's, metadata copied per country, `available_countries_codes` dropped, and a non-empty target refused
- [ ] 5.3 Add a parity test that migrates the Git-tracked `app/maps` to a temp dir and analyzes the regression farm sample. Ids 0–5 must match the flat root, and ids 6–9 must match 0 and 1

## 6. Frontend

- [ ] 6.1 Add `getCountries()` in `src/api` and switch `useAvailableCountries` to `GET /countries`
- [ ] 6.2 Make `getMaps` send `country=<selectedCountry>` when one is selected, and refetch when the country changes
- [ ] 6.3 Remove `available_countries_codes` from `AdminLayer`/`LayerInput` in `interfaces/AdminLayer.ts`, the countries field and validator in `LayerForm.tsx`, the countries column in `AdminLayersPageContent.tsx`, and the unused `admin.json` keys
- [ ] 6.4 Store `country` from the session response in the admin session context and show the country's name in `AdminPageContainer` (en/es)

## 7. Azure and docs

- [ ] 7.1 `render_api_app.py`: `MAPS_ROOT=/mnt/maps/v2`, and drop the `admin-passkey-hash` secret and env var
- [ ] 7.2 `deploy.sh`: replace `share_has_index` with a check for `v2/countries.json`, expect `/mnt/maps/v2` in the health check, and stop requiring `ADMIN_PASSKEY_HASH`
- [ ] 7.3 `deploy.sh countries <add|list|rotate|disable|enable> [CC]`: download `v2/countries.json` with its ETag, run the CLI on a temp root, check the ETag, and upload the registry and any new folder skeleton
- [ ] 7.4 Decide and document how the one-time migration runs against the share (a local SMB mount or a temporary Container Apps job), and write it in `docs/suggested_deployment.md` with the parity check and the rollback steps
- [ ] 7.5 Document for operators how to add, rotate and disable a country, and for admins that copied layers (GFW, TMF) are independent per country

## 8. Rollout

- [ ] 8.1 Deploy the new API against the flat root (legacy mode, admin off) and check that the public flow is unchanged
- [ ] 8.2 Run the migration to `/mnt/maps/v2`, store the three passkeys in the password manager, and run the parity check against the share
- [ ] 8.3 Deploy with `MAPS_ROOT=/mnt/maps/v2`. Smoke test: each country admin sees only their own layers, an analysis in each country works, and `GET /countries` returns CO, CR and EC
- [ ] 8.4 Hand each passkey to its country admin
