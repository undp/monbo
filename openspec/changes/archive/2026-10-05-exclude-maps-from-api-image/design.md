## Context

The API's layers have two homes today:

- **The Git checkout** (`monbo-api/app/maps`, flat layout, about 511 MB of GeoTIFFs in Git LFS). It is the default `MAPS_ROOT` for local development, the source of `./azure/deploy.sh seed`, and, because `Dockerfile.prod` copies `./app` whole, a part of every production image.
- **The Azure Files share** at `/mnt/maps` (per-country layout). This is what the deployed API reads when `STORAGE_ACCOUNT_NAME` is set, which is the only configuration in use.

The copy in the image exists to back one mode: deploying with `STORAGE_ACCOUNT_NAME` empty, where `render_api_app.py` adds no volume and no `MAPS_ROOT`, and the API serves the baked-in flat layout read-only. The `layer-storage-infrastructure` spec keeps that mode as its rollback path ("Rollback path while Git layers exist"), and `deploy.sh` checks for Git LFS pointers before every build because of it.

This is the first of five changes in the infra roadmap: this one, then the monorepo layout, unified CI, Terraform, and deployment from CI. The last two need an image that a CI runner can build without Git LFS, and a single deployment mode to describe in Terraform.

The decision taken in exploration is to keep the rasters in Git so a clone has working layers, and to drop the storage-less mode ("option A").

## Goals / Non-Goals

**Goals:**

- The production API image contains no layer data, and its build context doesn't either.
- Every checkout-based flow keeps working with no new steps:
  - local dev;
  - `Dockerfile.dev`;
  - `seed`;
  - tests;
  - CI.
- A deployed API that can't see any layers fails loudly at startup, not at the first analysis.
- Specs and docs stop promising the baked-in fallback.

**Non-Goals:**

- Removing the rasters from Git, converting them to COG in the repository, or pruning old LFS objects. These are tracked separately in the technical review.
- Moving `app/maps` out of `app/`. This could be reconsidered in the monorepo-layout change, but it is not needed here.
- Replacing `deploy.sh` (that is the Terraform change) or touching the frontend image.
- Changing `/health` or the probes.

## Decisions

### Exclude the whole `app/maps/`, not only `layers/rasters/`

Excluding only the rasters would leave `index.json` and the metadata in the image. An API started without `MAPS_ROOT` would then list six layers whose `.tif` files are missing, and it would fail per request with file errors. Excluding the folder makes the image consistently empty of layers, so the startup check below catches the misconfiguration.

- **Alternative: a build arg that keeps the layers** (`WITH_LAYERS=1`). Rejected: it would mean two images to keep correct for a mode nobody deploys.
- **Alternative: move the seed data out of `app/`**, so `COPY ./app` naturally skips it. Rejected for now: it changes the default `MAPS_ROOT`, `seed --source`, the docs and several tests, for the same result as one `.dockerignore` line.

### Fail at startup when `MAPS_ROOT` holds no layers

In `lifespan`, before the admin's job recovery, the API checks that the layers root contains `countries.json` or `index.json`. If neither exists, which includes the root folder itself being missing, startup raises with a message that:

- names the resolved root;
- explains that the image carries no layers;
- says to mount the share or a layers folder and set `MAPS_ROOT`.

The check goes through the storage module (`get_layers_root()`), so tests that point the store at a temporary root are covered, and no other module builds layer paths.

What this does in Azure: the container exits, the startup probe never passes, Container Apps keeps the previous revision serving, and `deploy.sh`'s health wait fails with a pointer to the logs.

- **Alternative: report it in `/health` with a 503.** Rejected: `/health` also backs the readiness probe of the single replica. Tying readiness to the share's contents would pull the replica out of traffic during a transient share hiccup, which the current probe design deliberately avoids by keeping liveness off the share.
- **Alternative: an informative `/health` field only.** Rejected as the main mechanism: nothing would fail, so the deploy would still look successful.

The check runs only at startup. An existing root that loses its files at runtime keeps the current behaviour.

### `deploy.sh` requires layer storage for the API

- `check_prerequisites` requires `STORAGE_ACCOUNT_NAME` for every command that deploys the API, as it already does for `storage` and `seed`.
- `deploy_api` always mounts, after the existing `share_has_layers` guard.
- The `MAPS_MOUNT=false` branch in `render_api_app.py` becomes dead and is removed, so the rendered app always has the volume and `MAPS_ROOT=/mnt/maps`.
- The admin's own guard ("needs persistent storage") becomes redundant but is harmless, and is kept.
- `check_rasters_are_real` moves out of the build path. `seed_share` already calls it, and the image no longer reads those files.

These scripts are replaced by Terraform in a later change, so the edits stay minimal and don't restructure the script.

### Running the production image locally

The README documents mounting the checkout's layers read-only:

```
docker run -v "$PWD/app/maps:/maps:ro" -e MAPS_ROOT=/maps …
```

The image runs as uid 10001, and Git checkouts create files readable by all users (0644), so a read-only mount works without `chown`.

## Risks / Trade-offs

- **[Risk] Lost rollback path.** Without the baked-in layers, there is no zero-dependency fallback if the share breaks. → Mitigation:
  - the share has soft delete (14 days), daily backups (30 days) and a `CanNotDelete` lock;
  - `seed` rebuilds it from Git in minutes;
  - the Rollback docs describe restoring from a snapshot or re-seeding.
- **[Risk] A test starts the app with an empty temporary root** and now fails at startup. → Mitigation: only the two `with TestClient(create_app())` tests in `test_ingestion.py` run the startup hook, through the `layers` fixture. Check that fixture's root has a registry or index, run the full suite, and fix any fixture that starts the app on an empty root by giving it an index.
- **[Risk] Someone runs an old `deploy.env` without `STORAGE_ACCOUNT_NAME`.** → Mitigation: `deploy.sh` stops before building or deploying, with a message pointing to `docs/suggested_deployment.md`.
- **[Trade-off] The clone still carries 511 MB of LFS.** This is intended: it is what lets a clone run with real layers.

## Migration Plan

1. Merge to `dev`. Nothing changes for local development, CI or the share.
2. The next `./azure/deploy.sh` builds the smaller image and deploys it with the mount, as before. Verify `/health` reports `mapsRoot=/mnt/maps` and writable (`deploy.sh` already does), and that `GET /maps?country=CO` lists the layers.
3. **Rollback:** redeploy the previous image tag with `./azure/deploy.sh --skip-build` and `TAG=<old>`. The old images still contain the layers. The share is untouched by this change.

## Open Questions

None. The scope was settled during exploration (option A, rasters kept in Git).
