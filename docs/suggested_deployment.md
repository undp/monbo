# Suggested deployment (Azure Container Apps)

`azure/deploy.sh` deploys the API and the frontend to Azure Container Apps. It is
idempotent: it creates what is missing and updates the rest. Configuration lives in
`azure/deploy.env` (copy `azure/deploy.env.example`; it is gitignored).

```sh
./azure/deploy.sh               # build, push and deploy both apps
./azure/deploy.sh --skip-build  # redeploy an image tag already in the registry
./azure/deploy.sh storage       # only ensure the persistent layer storage
./azure/deploy.sh destroy       # delete the apps' resource group (layer storage is kept)
```

## Layer storage

Without `STORAGE_ACCOUNT_NAME`, the API serves the layers baked into its image
(`monbo-api/app/maps`). With it, the API reads them from an Azure Files share mounted
at `/mnt/maps` (`MAPS_ROOT`), which the layers admin writes to. The share outlives
releases, restarts and new revisions.

| Resource | Default | Why |
|---|---|---|
| Resource group | `monbo-data` | Separate from the apps, so `destroy` can't delete the layers |
| Delete lock | `monbo-data-no-delete` (`CanNotDelete`) | Nothing in the group can be deleted by mistake |
| Storage account / share | `$STORAGE_ACCOUNT_NAME` / `maps` (10 GiB, SMB) | TLS 1.2+, no public blob access |
| Share soft delete | 14 days | A deleted share can be undeleted |
| Azure Backup | vault `monbo-backup`, policy `maps-daily-30d` | Daily snapshot at 06:00 UTC, kept 30 days |
| Environment storage | `maps` on the Container Apps environment | What the API's volume refers to |

The volume is mounted with `uid=10001,gid=10001,dir_mode=0750,file_mode=0640`: the
API image runs as uid/gid 10001 (`monbo-api/Dockerfile.prod`), and `chmod` is not
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
2. Seed the share from the Git-tracked layers (needs `git lfs pull`). The seed
   validates every raster, converts it to a Cloud Optimized GeoTIFF and writes an
   index with every layer enabled at version 1 (about 52 MB for the current six):

   ```sh
   cd monbo-api
   uv run python -m app.modules.layers.seed --target /tmp/maps-seed
   AZURE_STORAGE_KEY="$(az storage account keys list -g monbo-data -n "$STORAGE_ACCOUNT_NAME" --query '[0].value' -o tsv)" \
     az storage file upload-batch --account-name "$STORAGE_ACCOUNT_NAME" \
     --destination maps --source /tmp/maps-seed
   ```

   `deploy.sh` refuses to mount a share without an `index.json`. **Only seed an empty
   share**: the upload overwrites `index.json` and the metadata, and would drop every
   layer created or edited in the admin. If `deploy.sh` says it could not check the
   share, fix that error (network, storage firewall, key access) instead of seeding.
3. Deploy: `./azure/deploy.sh`. After the API is up, the script checks that `/health`
   reports `mapsRoot: /mnt/maps` and `mapsRootWritable: true`, and fails otherwise.
4. Compare the new deployment with the previous one on the regression farms; every
   value must be identical:

   ```sh
   cd monbo-api
   uv run python -m tests.regression.parity <previous-api-url> <new-api-url>
   ```

### Deploying while the admin is in use

Don't deploy while a raster upload is being processed (the admin page shows the job
as queued or running). During a deploy the previous revision keeps serving until the
new one is ready, so for a moment two API processes share the layers. The new revision
leaves a job that is still being updated alone and refuses new uploads until it ends,
but a deploy that stops the old revision mid-job fails that upload: the admin sees it
as interrupted (after up to 15 minutes) and has to upload the raster again.

### Rollback

While the layers are still in Git, removing `STORAGE_ACCOUNT_NAME` and redeploying
makes the API serve the image's layers again. Admin changes stay on the share.

To restore files from a backup, use the vault's "Restore" on the `maps` item in the
Azure portal (whole share or single files), or undelete the share within 14 days.

## Layers admin

With `ADMIN_PASSKEY_HASH` and `ADMIN_SESSION_SECRET` set (and layer storage enabled),
the admin is available at `https://<frontend>/admin`. Generate the values with:

```sh
cd monbo-api && uv run python -m app.modules.admin.passkey
```

It prints the passkey the admin logs in with (keep it in a password manager, never
in `deploy.env` or Azure), its hash and a session secret. `deploy.sh` stores the hash
and the secret as Container App secrets and sets `ADMIN_ALLOWED_ORIGIN` to the
frontend's Container Apps URL by default. How to manage layers there is in [maps.md](maps.md).

**Custom domains.** If the frontend is served from its own domain, set
`ADMIN_ALLOWED_ORIGIN` (for example `https://monbo.example.org`) in `azure/deploy.env`:
the admin rejects calls from any other origin. A custom domain bound directly to the
Container Apps keeps the login rate limit working, because it keys on the client IP
that the Container Apps ingress appends to `X-Forwarded-For`. A proxy in front of the
API (Front Door, Application Gateway) would become that IP for everyone, so 5 wrong
guesses from anyone would block all admins: that setup needs the API to trust the
proxy's hop first.

### Rotating the admin credentials

1. `uv run python -m app.modules.admin.passkey` to generate a new set.
2. Replace `ADMIN_PASSKEY_HASH` and `ADMIN_SESSION_SECRET` in `azure/deploy.env`.
3. `TAG=<deployed tag> ./azure/deploy.sh --skip-build` (it updates the secrets and restarts the API; without `TAG` it uses the current commit, which may not be in the registry).

The old passkey stops working, and every open admin session is signed out because
tokens are signed with the session secret. Rotating only `ADMIN_SESSION_SECRET` signs
everyone out but keeps the passkey.
