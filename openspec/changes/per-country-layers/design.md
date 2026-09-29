## Context

`add-layers-admin` introduced `LayerStore`, the single owner of every file under `MAPS_ROOT`:
- one `index.json` with every layer;
- per-language metadata;
- versioned COG rasters;
- `.jobs/` for ingestion state.

In Azure, `MAPS_ROOT` is an Azure Files share mounted at `/mnt/maps`, seeded from the Git-tracked `app/maps`.

The admin is protected by one passkey, stored as `ADMIN_PASSKEY_HASH` in a Container App secret. Its session token is an HMAC over `{iat, exp, jti}` and carries no identity. Layers declare their countries in `available_countries_codes`. GFW (id 0) and TMF (id 1) list EC, CO and CR, and the other four list one country each.

`country-first-flow` (deployed first) makes the frontend work with one country per analysis and derives the available countries from `GET /maps`.

Measured sizes: `gfw.tif` is 55 MB and `tmf.tif` 47 MB. Both cover only the EC+CO+CR region.

## Goals / Non-Goals

**Goals:**
- Each country's layers are independent and administered only by that country's admin.
- Adding, rotating or disabling a country is one operator command, with no redeploy and no restart.
- Analysis results for existing layers are identical before and after the migration.
- The URLs of analysis, tiles and image generation don't change.
- A rollback to the previous release is possible without restoring data.

**Non-Goals:**
- A superadmin, or managing countries from the web UI. The registry is designed so it can be added later.
- Sharing one raster between countries, or propagating edits of a copied layer to the other copies.
- Clipping rasters to country borders.
- Templates for creating a layer from another country's metadata.
- Removing layers from Git (`remove-layers-from-git`, still pending).

## Decisions

### D1. On-disk layout: one self-contained folder per country, plus a registry

```
MAPS_ROOT/
├── countries.json                      registry (D2)
├── CO/
│   ├── index.json                      layers of CO only, no available_countries_codes
│   ├── metadata/attributes/{en,es}/
│   ├── metadata/considerations/{en,es}/
│   └── layers/rasters/
├── EC/ …
├── CR/ …
└── .jobs/                              ingestion jobs for every country (D7)
```

A country folder has exactly today's layout. That keeps the atomic write, versioned raster, and metadata code unchanged; each operation now receives a country root. Folder names are validated uppercase ISO alpha-2 codes, so a code can never produce a path outside the root.

*Alternative:* one global `index.json` with a `country` field, and folders only for files. It is less isolated, and the user asked for a folder per country.

### D2. The registry lives on the share, not in environment secrets

`countries.json`:

```json
{
  "countries": [
    {"code": "CO", "passkey_hash": "<sha256 hex>", "enabled": true},
    {"code": "EC", "passkey_hash": "<sha256 hex>", "enabled": true}
  ]
}
```

Only the CLI writes it, with the same atomic temp-file-and-rename as the index. The API reads it through `LayerStore`, cached by mtime and size like the index, so edits apply on the next request without a restart. Only hashes are stored. Each passkey is 48 random bytes (64 characters), so brute-forcing the hash is not practical, and anyone who can write to the share can already alter layers.

*Alternatives:*
- **JSON of hashes in a Container App secret:** adding or rotating a country would need a redeploy and a restart, and a shared secret would change for every country.
- **Superadmin UI:** more surface than three countries justify. It can later write the same file.

### D3. Operator CLI

The CLI is `uv run python -m app.modules.admin.countries <command> [--root PATH]`, with `--root` defaulting to `MAPS_ROOT`.

| Command | Effect |
|---|---|
| `add CC` | Validate CC with `pycountry`, refuse existing codes, create `CC/` with an empty `index.json` and the metadata and raster folders, register it `enabled: true` with a new passkey, and print the passkey once |
| `list` | Code, name, enabled, number of layers, number of enabled layers |
| `rotate CC` | Replace the hash, print the new passkey. Sessions from the old passkey stop working (D5) |
| `disable CC` / `enable CC` | Flip `enabled`. Data untouched |

It prints passkeys to stdout only and writes nothing else outside the root. It replaces `app/modules/admin/passkey.py`. To run from `deploy.sh` without the API's configuration, it imports only the store and the hashing helper, never `app.config.env`.

`azure/deploy.sh countries <command> [CC]` runs the same CLI locally against a temporary directory:
1. download `v2/countries.json` with `az storage file download`;
2. run the CLI with `--root <tmp>`;
3. upload the changed `countries.json`, and for `add`, the new folder skeleton, with `az storage directory create` and `az storage file upload`.

The API never writes `countries.json`, so there is no concurrent writer.

### D4. Country lifecycle and `GET /countries`

```
 add CC ──▶ registered, 0 layers ──▶ layers uploaded, disabled ──▶ ≥1 layer enabled ──▶ disable CC
            admin can log in          still not public               listed by GET /countries   hidden, admin locked out
```

`GET /countries` returns `[{"code": "CO"}, …]` for countries that are `enabled` in the registry and have at least one enabled layer, sorted by code. A newly added country never shows up empty on the landing page. The frontend's `useAvailableCountries` (from `country-first-flow`) calls it instead of deriving the codes from `GET /maps`. The landing and header behavior doesn't change.

### D5. Login finds the country. The token carries the country and a passkey fingerprint

`POST /admin/session` hashes the submitted passkey and compares it, with `hmac.compare_digest`, against every enabled country's hash. It never stops early, so timing doesn't reveal how many countries exist or which one matched. Rate limiting and logging don't change, and a successful login is now logged with its country.

Token claims become `{iat, exp, jti, country, kid}`, where `kid` is the first 16 hex characters of the country's `passkey_hash`. `require_admin` verifies the signature and the expiry as today, then checks the registry: the country must exist, be enabled, and have a hash starting with `kid`. Otherwise it answers 401. So `rotate` and `disable` take effect on the next request, without rotating `ADMIN_SESSION_SECRET`. A token from before this change has no `country` and is rejected.

`POST /admin/session` and `GET /admin/session` also return `country`, so the admin UI can show "Admin · Colombia".

The admin routes are registered when `ADMIN_SESSION_SECRET` is set and the root has the per-country layout. `ADMIN_PASSKEY_HASH` is removed. If it is still set, the API logs a warning at startup saying it is ignored.

### D6. Globally unique layer ids

A layer's id is unique across all countries. `LayerStore` keeps an id → country map built from every country's index, cached by the mtimes of the indexes. `get_map_by_id` resolves the country from it, so `/deforestation_analysis/analize`, `/tiles/{map_id}/...` and `/generate-image` keep their current contracts. A new layer gets `max(ids of all countries) + 1`, computed under the store lock, and ids are never reused.

`GET /maps?country=CC` returns the enabled layers of CC. Without `country` it returns every enabled layer, as today. The public response keeps `availableCountriesCodes`, now always `[<layer's country>]`, so existing consumers keep working.

*Alternative:* numbering from 0 within each country, with the country in every route. It changes four routes and the ids of existing layers, and it complicates the parity check. Discussed and rejected.

### D7. Admin scope comes from the token, never from the URL

`GET/POST /admin/layers`, `PUT/PATCH /admin/layers/{id}` and `PUT /admin/layers/{id}/raster` act on the session's country. A layer id that belongs to another country answers 404, the same as an unknown id, so ids of other countries are not revealed.

Ingestion jobs record `country` and `layer_id`. `GET /admin/jobs/{id}` answers 404 for another country's job.

Only one ingestion runs at a time for all countries, because there is one replica and the conversion is CPU- and memory-heavy. The 409 says another upload is in progress and does not name the country.

`.jobs/` stays at the root. Rasters are written to `<CC>/layers/rasters/`.

### D8. Migration: copy GFW and TMF whole, keep the original ids

`uv run python -m app.modules.layers.migrate_countries --source <flat root> --target <new root>`:

1. Refuse if the target has content, or if the source is not a flat layout.
2. For each source layer, in id order, and for each code in its `available_countries_codes`, in listed order:
   - the first code keeps the layer's id; later codes get new ids from a running `max + 1`;
   - copy the raster (`shutil.copyfile`, never `copy`, because of the no-chmod mount) and its metadata files into that country's folder;
   - write the entry without `available_countries_codes`, keeping `enabled`, `version`, `raster_filename`, the years, the pixel size and the references.
3. Register every country found, with a fresh passkey each, and print them.
4. Print a summary of the id mapping.

With the current index this produces:

| Layer | EC | CO | CR |
|---|---|---|---|
| GFW | 0 | 6 | 7 |
| TMF | 1 | 8 | 9 |
| Ecuador | 2 | | |
| IDEAM | | 3 | |
| Ecuador2 | 4 | | |
| MOCUPP | | | 5 |

**Rasters are not clipped.** Farm F08 of the regression set crosses a border. Clipping would change its ratio and break the parity requirement.

**Parity check.** After migrating, the regression farm sample is analyzed against the new root:
- ids 0–5 must give exactly the results of the flat root;
- ids 6–9 must equal their origin (0 or 1).

### D9. Legacy flat roots are served read-only

When `MAPS_ROOT` has a top-level `index.json` and no `countries.json`, `LayerStore` runs in legacy mode:
- `GET /maps` (with or without `country`) filters by `available_countries_codes`;
- `GET /countries` is the union of the codes of enabled layers;
- lookup by id works as today;
- the admin routes are not registered, and a startup warning says so.

This keeps three things working without restructuring the Git-tracked `app/maps` (which would duplicate about 100 MB in LFS):
- local development;
- open-source deployments;
- the regression tests.

It also lets the new image run against the old share layout if needed. A root with both files, or neither, fails at startup with an explicit error.

### D10. Azure: new layout in `/mnt/maps/v2`, flat layout kept for rollback

The migration runs once, from an operator machine, with the share mounted locally or through a temporary job container. Its source is `/mnt/maps` (the seeded flat layout) and its target is `/mnt/maps/v2`. `render_api_app.py` sets `MAPS_ROOT=/mnt/maps/v2` and drops `admin-passkey-hash`.

`deploy.sh` refuses to deploy when `v2/countries.json` is missing, and its health check expects `mapsRoot=/mnt/maps/v2` and writable.

**Rollback:** redeploy the previous image with `MAPS_ROOT=/mnt/maps` and the old `ADMIN_PASSKEY_HASH`. It serves the untouched flat layout. Admin edits made after the migration are not reflected, which is an accepted limit of the rollback window. The flat files are removed in a later change once the new layout is trusted.

## Risks / Trade-offs

- **[Copies drift apart]** When GFW publishes a new year, each country's admin uploads it separately, and the EC, CO and CR GFW metadata can diverge. → Intended: each country decides when to adopt a new version. Documented for admins.
- **[Duplicated storage]** About 200 MB more on the share. → Negligible next to the share size and cost. Clipping was rejected (D8).
- **[Registry edited by hand incorrectly]** A malformed `countries.json` would lock out every admin. → Only the CLI writes it, atomically. The API logs an error and keeps serving public routes with the last valid cached copy. On an unreadable registry at startup, admin logins fail and public routes still work.
- **[deploy.sh read-modify-write race]** Two operators running `deploy.sh countries` at the same time could overwrite each other's `countries.json`. → Rare, since operator actions are manual. The command re-downloads the file and compares its ETag before uploading, and aborts if it changed.
- **[Login cost grows with countries]** A constant-time scan over N hashes. → Negligible for any realistic N.
- **[Passkey handover]** The migration prints three passkeys at once. → The runbook says to put each one straight into the password manager and share it only with that country's admin.
- **[Legacy mode hides misconfiguration]** Pointing `MAPS_ROOT` at the old flat folder in production would silently turn off the admin. → A startup warning, and the `deploy.sh` check for `v2/countries.json`.
- **[Sessions of the previous release]** Tokens without `country` stop working after deploy. → Admins log in again with their new country passkey. The deploy notes say so.

## Migration Plan

1. Deploy `country-first-flow` (frontend only).
2. Build the new images. The new API still works against the flat root in legacy mode (D9), so it can be deployed before migrating, with the admin off.
3. Run `migrate_countries` from `/mnt/maps` to `/mnt/maps/v2`. Store the three printed passkeys.
4. Run the parity check (D8) against `/mnt/maps/v2`.
5. Deploy with `MAPS_ROOT=/mnt/maps/v2`, without `ADMIN_PASSKEY_HASH`. `deploy.sh` verifies the registry and the health check.
6. Hand each country's passkey to its admin. Smoke test: each admin sees only their own layers, and an analysis in each country works.
7. Rollback: D10.

## Open Questions

- How the operator runs the one-time migration against the share: mounting it locally over SMB, or a temporary Container Apps job with the same mount. The deploy docs will pick one after trying both.
