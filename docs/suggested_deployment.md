# Suggested deployment (Azure Container Apps)

`azure/deploy.sh` deploys the API and the frontend to Azure Container Apps. It is
idempotent: it creates what is missing and updates the rest. Configuration lives in
`azure/deploy.env` (copy `azure/deploy.env.example`; it is gitignored). How the
resources fit together is in [architecture.md](architecture.md).

```sh
./azure/deploy.sh               # build, push and deploy both apps
./azure/deploy.sh --skip-build  # redeploy an image tag already in the registry
./azure/deploy.sh storage       # only ensure the persistent layer storage
./azure/deploy.sh countries …   # manage the countries and their admin passkeys (below)
./azure/deploy.sh destroy       # delete the apps' resource group (layer storage is kept)
```

## Layer storage

The API reads its layers from an Azure Files share mounted at `/mnt/maps`
(`MAPS_ROOT`), in the per-country layout the layers admin writes to
([maps.md](maps.md#per-country-layout)). The share outlives releases, restarts and new
revisions. `STORAGE_ACCOUNT_NAME` is required: the API image carries no layers (the
Git-tracked `apps/api/app/maps` is only the source the share is seeded from), and an
API that finds no layers at `MAPS_ROOT` refuses to start.

| Resource | Default | Why |
|---|---|---|
| Resource group | `monbo-data` | Separate from the apps, so `destroy` can't delete the layers |
| Delete lock | `monbo-data-no-delete` (`CanNotDelete`) | Nothing in the group can be deleted by mistake |
| Storage account / share | `$STORAGE_ACCOUNT_NAME` / `maps` (10 GiB, SMB) | TLS 1.2+, no public blob access |
| Share soft delete | 14 days | A deleted share can be undeleted |
| Azure Backup | vault `monbo-backup`, policy `maps-daily-30d` | Daily snapshot at 06:00 UTC, kept 30 days |
| Environment storage | `maps` on the Container Apps environment | What the API's volume refers to |

The volume is mounted with `uid=10001,gid=10001,dir_mode=0750,file_mode=0640`: the
API image runs as uid/gid 10001 (`apps/api/Dockerfile.prod`), and `chmod` is not
possible on the share.

The API is pinned to one replica (`minReplicas`/`maxReplicas: 1`): the lock that
serializes writes to the share, the login rate limit and the single ingestion slot
live in the API's memory. Don't scale it out while the admin is enabled.

`deploy.sh` replaces the whole API app on every deploy (`azure/render_api_app.py`
defines it). Its container, env vars, secrets, registry and scale settings come only
from that script, so change them there or in `azure/deploy.env`, not in the portal: an
env var, secret or scale rule added in the portal is dropped by the next deploy. Custom
domains, IP restrictions, CORS, the identity, tags and the workload profile are kept.

### First-time setup

1. Create the storage: set `STORAGE_ACCOUNT_NAME` in `azure/deploy.env`, then
   `./azure/deploy.sh storage`.
2. Fill the share with the Git-tracked layers (needs `git lfs pull` and `uv`):

   ```sh
   ./azure/deploy.sh seed
   ```

   It validates every raster and converts it to a Cloud Optimized GeoTIFF
   (`app.modules.layers.seed`), splits the layers by country
   (`app.modules.layers.migrate_countries`, which copies GFW and TMF into each
   country and numbers each country's layers from 0), and uploads the result to the
   share's root. It prints **one admin passkey per country**: put each one in the
   password manager straight away. It also writes each country's old id → new id to
   `/tmp/monbo-seed-ids.json` (`SEED_MAPPING_OUT`), for step 4.
3. Deploy: `./azure/deploy.sh`. `deploy.sh` refuses to mount a share without
   `countries.json`, and after the API is up it checks that `/health` reports
   `mapsRoot: /mnt/maps` and `mapsRootWritable: true`. If it says it could not check
   the share, fix that error (network, storage firewall, key access) instead of
   seeding: `seed` empties a share that already holds layers.
4. Optionally, compare the deployment with the Git layers on the regression farms.
   Every layer copy, in every country, must give the results of the original:

   ```sh
   cd apps/api
   MAPS_ROOT=app/maps uv run uvicorn app.main:app --port 8001 &
   uv run python -m tests.regression.parity --mapping /tmp/monbo-seed-ids.json \
     http://localhost:8001 <api-url>
   ```

### Starting an environment's layers over

`./azure/deploy.sh seed` also works on a share that already has layers, for example
a development environment filled before countries had their own folders. After you
type the share's name to confirm, it prepares the new layers, **deletes every file on
the share** (layers, raster versions, admin edits, ingestion jobs), and uploads the
Git-tracked layers again. Deploy right after, so the API reads the new layout. Every
country gets a new passkey.

Before emptying the share, `seed` takes a snapshot of it and prints its timestamp:
that is the one to restore (see [Rollback](#rollback)), since the daily backup may be
hours old. `countries.json` is uploaded last, so if the upload dies midway the share
has none and `deploy.sh` refuses to mount it: run `seed` again. The running API keeps
serving during the swap, so analyses, tiles and the admin fail until the upload
ends, and admin edits made meanwhile are lost: run it when nobody is using the
environment.

### Deploying while the admin is in use

Don't deploy while a raster upload is being processed (the admin page shows the job
as queued or running). During a deploy the previous revision keeps serving until the
new one is ready, so for a moment two API processes share the layers. The new revision
leaves a job that is still being updated alone and refuses new uploads until it ends,
but a deploy that stops the old revision mid-job fails that upload: the admin sees it
as interrupted (after up to 15 minutes) and has to upload the raster again.

### Rollback

- **Back to an earlier image:** `TAG=<tag> ./azure/deploy.sh --skip-build` redeploys
  an image already in the registry, with the same share. As with any deploy, don't do
  it while a raster upload is being processed (see above).
- **Back to the Git layers:** `./azure/deploy.sh seed` rebuilds the share from the
  Git-tracked layers (it snapshots the current content first). Admin changes are lost.
- **Back to a release from before per-country layers:** that release reads the old
  flat layout. Restore the share from a snapshot taken before the seed, then deploy
  that release with its own `deploy.sh` and `deploy.env`.
- **Restoring files:** use the vault's "Restore" on the `maps` item in the Azure
  portal (whole share or single files), or undelete the share within 14 days.

## Layers admin

With `ADMIN_SESSION_SECRET` set (and layer storage in the per-country layout), the
admin is available at `https://<frontend>/admin`. Each country's admin logs in with
their own passkey and only sees their country's layers. Generate the secret with:

```sh
python3 -c "import secrets; print(secrets.token_urlsafe(48))"
```

`deploy.sh` stores it as a Container App secret and sets `ADMIN_ALLOWED_ORIGIN` to the
frontend's Container Apps URL by default. Rotating it (replace it in `deploy.env`, then
`TAG=<deployed tag> ./azure/deploy.sh --skip-build`) signs every admin of every
country out. How to manage layers is in [maps.md](maps.md).

**Custom domains.** If the frontend is served from its own domain, set
`ADMIN_ALLOWED_ORIGIN` (for example `https://monbo.example.org`) in `azure/deploy.env`:
the admin rejects calls from any other origin. A custom domain bound directly to the
Container Apps keeps the login rate limit working, because it keys on the client IP
that the Container Apps ingress appends to `X-Forwarded-For`. A proxy in front of the
API (Front Door, Application Gateway) would become that IP for everyone, so 5 wrong
guesses from anyone would block all admins: that setup needs the API to trust the
proxy's hop first.

### Countries and admin passkeys

Each country's passkey hash lives in the share's `countries.json`, not in Azure.
`deploy.sh countries` edits it without redeploying: the API applies the change on its
next request. The command needs the `azure` uv dependency group, which `uv run`
installs from `apps/api/uv.lock`.

```sh
./azure/deploy.sh countries list             # countries, their state and layers
./azure/deploy.sh countries add PE           # new country (empty); prints its passkey once
./azure/deploy.sh countries rotate CR        # new passkey for CR; its sessions end
./azure/deploy.sh countries disable EC       # hidden from the app, admin locked out
./azure/deploy.sh countries enable EC
./azure/deploy.sh countries unlock           # recover after an interrupted update
```

It needs `uv` and the repository: it runs the same command as
`uv run python -m app.modules.admin.countries` on a local copy of the registry, then
leases `countries.json`, checks its ETag and uploads it. If someone else changed
the registry meanwhile, it stops without uploading; run it again. For `add`, the
new passkey is printed only after the folder and registry are uploaded.

If a process dies during an update, Azure Files can retain its file lease. After
checking that no `countries` command is still running, use `countries unlock` to
break that lease and retry the update.

- **Adding a country**: `countries add <code>`, then give the passkey to that
  country's admin. The country appears on the landing page once it publishes a layer.
  Its GFW and TMF need their own rasters: the current ones only cover Ecuador,
  Colombia and Costa Rica.
- **A leaked passkey**: `countries rotate <code>`. Only that country is affected.
- Keep each passkey in the password manager and share it only with that country's
  admin. It is never stored anywhere else.
- **Never put the hash of a chosen password in `countries.json`.** Only an unsalted
  SHA-256 of each passkey is stored, which is safe for the random passkeys `add` and
  `rotate` generate, but not for a memorable password: anyone who gets the hash could
  recover a weak passkey offline, and the login rate limit would then be the only
  protection. If a country's hash ever came from a chosen password, `rotate` it.
