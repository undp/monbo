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
possible on the share. The API is pinned to one replica.

### First-time setup

1. Create the storage: set `STORAGE_ACCOUNT_NAME` in `azure/deploy.env`, then
   `./azure/deploy.sh storage`.
2. Seed the share from the Git-tracked layers (needs `git lfs pull`). The seed
   validates every raster, converts it to a Cloud Optimized GeoTIFF and writes an
   index with every layer enabled at version 1 (about 52 MB for the current six):

   ```sh
   cd monbo-api
   uv run python -m app.modules.layers.seed --target /tmp/maps-seed
   az storage file upload-batch --account-name "$STORAGE_ACCOUNT_NAME" \
     --account-key "$(az storage account keys list -g monbo-data -n "$STORAGE_ACCOUNT_NAME" --query '[0].value' -o tsv)" \
     --destination maps --source /tmp/maps-seed
   ```

   `deploy.sh` refuses to mount a share without an `index.json`.
3. Deploy: `./azure/deploy.sh`. After the API is up, the script checks that `/health`
   reports `mapsRoot: /mnt/maps` and `mapsRootWritable: true`, and fails otherwise.
4. Compare the new deployment with the previous one on the regression farms; every
   value must be identical:

   ```sh
   cd monbo-api
   uv run python -m tests.regression.parity <previous-api-url> <new-api-url>
   ```

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
frontend's URL.

### Rotating the admin credentials

1. `uv run python -m app.modules.admin.passkey` to generate a new set.
2. Replace `ADMIN_PASSKEY_HASH` and `ADMIN_SESSION_SECRET` in `azure/deploy.env`.
3. `TAG=<deployed tag> ./azure/deploy.sh --skip-build` (it updates the secrets and restarts the API; without `TAG` it uses the current commit, which may not be in the registry).

The old passkey stops working, and every open admin session is signed out because
tokens are signed with the session secret. Rotating only `ADMIN_SESSION_SECRET` signs
everyone out but keeps the passkey.
