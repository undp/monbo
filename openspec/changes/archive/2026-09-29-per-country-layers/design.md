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
- A new environment, or one started over, gets its layers with one command.

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

It prints passkeys to stdout only and writes nothing else outside the root. It replaces `app/modules/admin/passkey.py`. Like the other API commands, it loads the API's configuration: `app/modules/__init__.py` imports every router. `--root` makes it independent of `MAPS_ROOT`.

`azure/deploy.sh countries <command> [CC]` runs the same CLI locally against a temporary directory:
1. download `countries.json` with `az storage file download`;
2. run the CLI with `--root <tmp>`;
3. upload the changed `countries.json` with `az storage file upload`, and for `add`, the new folder with `az storage file upload-batch`.

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

### D6. Each country numbers its layers from 0; the country travels with the id

A layer is identified by its country and its id. Ids are numbered from 0 within each country and never reused. Creating a layer takes `max(ids of that country) + 1` under the store lock, reading only that country's index.

The public routes that take a layer name its country:
- `POST /deforestation_analysis/analize`: `country` in the body.
- `POST /deforestation_analysis/generate-image`: `country` in the body.
- Tiles: `GET /deforestation_analysis/tiles/{country}/{id}/dynamic/{z}/{x}/{y}.png`. A GET has no body, and the country in the path keeps tile URLs cacheable.

With the per-country layout a missing country is a 422. With a flat root the country is optional, because its ids are global. If it is given, the layer must list it.

The frontend sends the session's selected country. Everything else it does with layer ids stays within a one-country session, so it doesn't change.

`GET /maps?country=CC` returns the enabled layers of CC. Without `country` it returns every enabled layer, each with `availableCountriesCodes: [<its country>]`: ids repeat across countries there, so consumers must read the country too.

*Alternative (first choice, then dropped):* globally unique ids, so those routes wouldn't change. Creating a layer had to read every country's index to find the next id, and the country was implicit in the id. The user chose per-country numbering.

### D7. Admin scope comes from the token, never from the URL

`GET/POST /admin/layers`, `PUT/PATCH /admin/layers/{id}` and `PUT /admin/layers/{id}/raster` act on the session's country. A layer id that belongs to another country answers 404, the same as an unknown id, so ids of other countries are not revealed.

Ingestion jobs record `country` and `layer_id`. `GET /admin/jobs/{id}` answers 404 for another country's job.

Only one ingestion runs at a time for all countries, because there is one replica and the conversion is CPU- and memory-heavy. The 409 says another upload is in progress and does not name the country.

`.jobs/` stays at the root. Rasters are written to `<CC>/layers/rasters/`.

### D8. Migration: copy GFW and TMF whole, number each country from 0

`uv run python -m app.modules.layers.migrate_countries --source <flat root> --target <new root> [--mapping-out ids.json]`:

1. Refuse if the target has content, or if the source is not a flat layout.
2. For each source layer, in id order, and for each code in its `available_countries_codes`:
   - give it that country's next id, starting from 0;
   - copy the raster (`shutil.copyfile`, never `copy`, because of the no-chmod mount) and its metadata files into that country's folder;
   - write the entry without `available_countries_codes`, keeping `enabled`, `version`, `raster_filename`, the years, the pixel size and the references.
3. Register every country found, with a fresh passkey each, and print them.
4. Print the id mapping, and with `--mapping-out`, write it as `{country: {old id: new id}}`.

With the current index this produces:

| Layer (old id) | EC | CO | CR |
|---|---|---|---|
| GFW (0) | 0 | 0 | 0 |
| TMF (1) | 1 | 1 | 1 |
| Ecuador (2) | 2 | | |
| IDEAM (3) | | 2 | |
| Ecuador2 (4) | 3 | | |
| MOCUPP (5) | | | 2 |

**Rasters are not clipped.** Farm F08 of the regression set crosses a border. Clipping would change its ratio and break the parity requirement.

**Parity check.** `tests.regression.parity --mapping ids.json <flat API> <per-country API>` analyzes the regression farm sample on both. For every country, each new id must give exactly the results its old id gave on the flat root. The same check runs in CI on the regression fixture layers.

### D9. Legacy flat roots are served read-only

When `MAPS_ROOT` has a top-level `index.json` and no `countries.json`, `LayerStore` runs in legacy mode:
- `GET /maps` (with or without `country`) filters by `available_countries_codes`;
- `GET /countries` is the union of the codes of enabled layers;
- lookup by id works as today (the country is optional);
- the admin routes are not registered, and a startup warning says so.

This keeps three things working without restructuring the Git-tracked `app/maps` (which would duplicate about 100 MB in LFS):
- local development;
- open-source deployments;
- the regression tests.

It also lets the new image run against the old share layout if needed. A root with both files fails at startup with an explicit error. A root with neither is treated as a flat root whose index is missing (500 on `GET /maps`, as today), so a share that is briefly unreachable at startup doesn't keep the API down.

### D10. Azure: the per-country layout at the share's root, filled from Git

The share had only been filled in the development environment, and production has none yet. So nothing is migrated in place: `MAPS_ROOT` stays `/mnt/maps`, and the per-country layout goes at the share's root.

`./azure/deploy.sh seed` fills a share from the Git-tracked layers:
1. run `app.modules.layers.seed` into a temporary folder (validation and COG conversion);
2. run `migrate_countries` on it, which prints the passkeys and writes the id mapping;
3. only then, if the share has files, empty it (`az storage file delete-batch`);
4. upload the result (`upload-batch`).

On a share that already has files, it first asks the operator to type the share's name, and nothing is touched until the new layers are ready locally. The same command covers the first production setup and starting dev over. Dev's admin edits are dropped, and a share snapshot keeps them.

`render_api_app.py` drops `admin-passkey-hash`. `deploy.sh` refuses to deploy when `countries.json` is missing, and its health check expects `mapsRoot=/mnt/maps` and writable.

**Rollback:**
- Removing `STORAGE_ACCOUNT_NAME` serves the image's Git-tracked layers, read-only (flat layout, admin off).
- Going back to a release from before this change needs the flat layout: restore the share from a snapshot taken before the seed, then deploy that release with its own `deploy.sh`.

*Alternative (first plan, dropped):* migrating in place into `/mnt/maps/v2` and keeping the flat layout at the root for rollback. It only made sense to preserve production data, and there is none.

## Risks / Trade-offs

- **[Copies drift apart]** When GFW publishes a new year, each country's admin uploads it separately, and the EC, CO and CR GFW metadata can diverge. → Intended: each country decides when to adopt a new version. Documented for admins.
- **[Duplicated storage]** About 200 MB more on the share. → Negligible next to the share size and cost. Clipping was rejected (D8).
- **[Registry edited by hand incorrectly]** A malformed `countries.json` would lock out every admin. → Only the CLI writes it, atomically. The API logs an error and keeps serving public routes with the last valid cached copy. On an unreadable registry at startup, admin logins fail and public routes still work.
- **[deploy.sh read-modify-write race]** Two operators running `deploy.sh countries` at the same time could overwrite each other's `countries.json`. → Rare, since operator actions are manual. The command re-downloads the file and compares its ETag before uploading, and aborts if it changed.
- **[Login cost grows with countries]** A constant-time scan over N hashes. → Negligible for any realistic N.
- **[Passkey handover]** The migration prints three passkeys at once. → The runbook says to put each one straight into the password manager and share it only with that country's admin.
- **[Legacy mode hides misconfiguration]** Pointing `MAPS_ROOT` at the old flat folder in production would silently turn off the admin. → A startup warning, and the `deploy.sh` check for `countries.json`.
- **[Sessions of the previous release]** Tokens without `country` stop working after deploy. → Admins log in again with their new country passkey. The deploy notes say so.

## Migration Plan

1. Deploy `country-first-flow` (frontend only).
2. **Development:** run `./azure/deploy.sh seed` (confirm the share name), store the three printed passkeys, then deploy this release with `ADMIN_SESSION_SECRET`. Optionally check parity against the Git layers (`tests.regression.parity --mapping /tmp/monbo-seed-ids.json`).
3. Smoke test: each country admin sees only their own layers, an analysis in each country works, and `GET /countries` returns CO, CR and EC.
4. **Production:** `./azure/deploy.sh storage`, `./azure/deploy.sh seed` (the share is empty, so there is no prompt), then deploy.
5. Hand each passkey to its country admin.
6. Rollback: D10.

## Open Questions

- `deploy.sh seed` has only been run locally up to the upload (seed and split). Its first run against the development share is part of the rollout.
