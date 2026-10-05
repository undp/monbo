## Why

Since `add-layers-admin`, the deployed API reads its layers from the Azure Files share at `MAPS_ROOT=/mnt/maps`. `Dockerfile.prod` still runs `COPY ./app ./app`, and `monbo-api/.dockerignore` doesn't exclude `app/maps/`, so every API image still carries 511 MB of rasters it never reads. They are also sent to the Docker daemon as build context on every build.

They are there only because of one fallback: with `STORAGE_ACCOUNT_NAME` empty, the API serves the layers baked into the image. That fallback is the last reason the image needs the rasters, and the next steps of the infra roadmap depend on dropping it:

- a CI build would otherwise have to pull 511 MB of Git LFS on every deploy;
- Terraform would otherwise have to keep a second, storage-less deployment mode.

## What Changes

- **The API production image no longer contains `app/maps/`**: no rasters, `index.json` or metadata. `monbo-api/.dockerignore` excludes the whole folder, so it also leaves the build context.
- **The rasters stay in Git (LFS).** Whoever clones the repository still gets the layers. Every flow that reads from the checkout keeps working unchanged:
  - `pnpm dev` / `uv run fastapi dev`, with `MAPS_ROOT` defaulting to `app/maps`;
  - `Dockerfile.dev`, which bind-mounts the source;
  - `./azure/deploy.sh seed`, which seeds the share from `app/maps`;
  - the test suite.
- **BREAKING (deployment): the "no share" mode is removed.**
  - `azure/deploy.sh` refuses to deploy the API without `STORAGE_ACCOUNT_NAME`.
  - The rollback path "remove `STORAGE_ACCOUNT_NAME` and serve the image's layers" goes away. Rolling back layer data means restoring the share from a snapshot or backup, which the storage already provides.
- **The API refuses to start without layers.** If `MAPS_ROOT` has neither `countries.json` (per-country layout) nor `index.json` (flat layout), startup fails with an explicit message. Today the API would start and fail only at the first analysis or tile request. In Azure, a revision like that never becomes ready, and the deploy fails at its health check.
- **`deploy.sh` checks the rasters only where they are used.** The Git LFS pointer check (`check_rasters_are_real`) runs before `seed`, and no longer before every image build.
- **Running the production image locally** means mounting a layers folder and setting `MAPS_ROOT`, for example the repository's `app/maps`, read-only. The README documents it.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `layer-storage-infrastructure`:
  - the API image SHALL NOT contain layers;
  - deploying the API requires the layer storage;
  - the requirement "Rollback path while Git layers exist" is removed, and rollback relies on share snapshots and backups;
  - the deployment script checks for Git LFS pointers only before seeding.
- `layer-storage`: the API refuses to start when `MAPS_ROOT` holds no layers in either layout.

## Impact

- **Docker:**
  - `monbo-api/.dockerignore` (exclude `app/maps/`);
  - `monbo-api/Dockerfile.prod` is unchanged, but its `COPY ./app ./app` stops carrying the layers.
- **API code:**
  - `app/main.py` gets a startup check in `lifespan`;
  - tests for it;
  - existing tests that start the app with an empty layers root may need a fixture with an index.
- **Deployment:**
  - `azure/deploy.sh`: header comments, `check_prerequisites`, `check_rasters_are_real` only in `seed_share`, and an API deploy that requires `STORAGE_ACCOUNT_NAME`;
  - `azure/deploy.env.example`: the `STORAGE_ACCOUNT_NAME` comment.
- **Docs:**
  - `docs/suggested_deployment.md`: the "Layer storage" intro and the "Rollback" section;
  - `docs/architecture.md`, if it mentions baked layers;
  - `monbo-api/README.md`: "Using Docker for production mode" and the `MAPS_ROOT` description.
- **Size:** measured locally, the API image goes from 2.76 GB to 1.69 GB (−1.07 GB). The layers counted twice, because `Dockerfile.prod`'s `RUN chown -R ./app` duplicates the `COPY ./app` layer. The build context goes from 536.84 MB to 360 kB. Every push, pull and cold start gets faster.
- **Unaffected:** the frontend, the Git LFS tracking in `.gitattributes`, the clone size, and the share's contents.
