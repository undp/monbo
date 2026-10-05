## 1. Baseline

- [x] 1.1 Branch from `origin/dev`. With the LFS rasters pulled, build the current image (`docker build -f Dockerfile.prod -t monbo-api:before monbo-api`) and record its size (`docker image ls`) and the "transferring context" size from the build log in `.context/`. Also confirm it contains `app/maps`: `docker run --rm --entrypoint ls monbo-api:before app/maps`

## 2. Image and build context

- [x] 2.1 In `monbo-api/.dockerignore`, exclude `app/maps/` with a comment explaining why: the layers live on the share (`MAPS_ROOT`), they stay in Git for clones and `seed`, and the image must not carry them
- [x] 2.2 Rebuild as `monbo-api:after`. Verify:
  - `app/maps` is absent from the image;
  - the image is about 511 MB smaller;
  - the build context no longer includes the rasters
- [x] 2.3 Check that nothing else in the image build reads `app/maps`: `Dockerfile.prod`, and app code that runs at import time

## 3. Startup check

- [x] 3.1 Add a method to the storage module (`LayersRoot` in `app/modules/layers/store.py`) that reports whether the root holds a layout, i.e. `countries.json` or `index.json` exists. Don't build paths outside the module
- [x] 3.2 In `lifespan` (`app/main.py`), before job recovery, raise a clear error when the root has no layout. The message names the resolved root and says to mount the share or a layers folder and set `MAPS_ROOT`. Don't touch `/health` or `/health/live`
- [x] 3.3 Tests:
  - startup fails on an empty and on a missing root;
  - startup succeeds on a flat root and on a per-country root;
  - `/health/live` is unaffected.
  Use `with TestClient(create_app())` so the startup hook runs
- [x] 3.4 Make sure the existing startup-hook tests in `tests/modules/admin/test_ingestion.py` still pass: their `layers` fixture root must hold a layout. Run the full suite with `uv run pytest`, plus ruff, black and mypy
- [x] 3.5 Run `docker run --rm monbo-api:after` without `MAPS_ROOT` and confirm the process exits at startup with the new message

## 4. Deployment script

- [x] 4.1 `azure/deploy.sh` `check_prerequisites`: for commands that deploy the API (the default and `--skip-build`), require `STORAGE_ACCOUNT_NAME`, with a message pointing to `docs/suggested_deployment.md`
- [x] 4.2 Remove `check_rasters_are_real` from the build path in `check_prerequisites`. Keep it in `seed_share`, and update its comment: the rasters are needed for seeding, not for the image
- [x] 4.3 `deploy_api` always mounts, after the existing `share_has_layers` guard. Remove the `MAPS_MOUNT=false` path from `azure/render_api_app.py` and from its docstring, so the rendered app always has the volume and `MAPS_ROOT=/mnt/maps`
- [x] 4.4 Update the comments that describe the baked-in mode:
  - the `deploy.sh` header ("instead of the ones baked into the image") and the storage defaults comment ("Empty STORAGE_ACCOUNT_NAME = the API serves the layers baked into its image");
  - the `STORAGE_ACCOUNT_NAME` comment in `azure/deploy.env.example`, which becomes required
- [x] 4.5 Sanity-check the script without Azure: `bash -n azure/deploy.sh`, and run it with `STORAGE_ACCOUNT_NAME` empty and confirm it dies before building. Check `render_api_app.py` output with dummy env values

## 5. Docs

- [x] 5.1 `docs/suggested_deployment.md`:
  - the "Layer storage" intro: the share is required, and the image has no layers;
  - "Rollback": remove "Back to the image's layers". Rollback is restoring a snapshot or backup, re-seeding from Git, or redeploying an older image tag;
  - the deploy steps, wherever storage reads as optional
- [x] 5.2 `docs/architecture.md`: the flat-layout row ("and the image's fallback without a share") and any other mention of baked layers
- [x] 5.3 `docs/maps.md`: check the layout and roots tables for the image fallback
- [x] 5.4 `monbo-api/README.md`:
  - "Using Docker for production mode": `docker run` needs a layers folder, e.g. `-v "$PWD/app/maps:/maps:ro" -e MAPS_ROOT=/maps`;
  - the `MAPS_ROOT` variable description: the default `app/maps` applies to the checkout, not the image;
  - the line "uses the raster layers located in `monbo-api/app/maps`"
- [x] 5.5 Run `grep -rn "baked\|image's layers\|layers baked" docs azure monbo-api/README.md README.md` and fix any remaining mention

## 6. Verification and PR

- [x] 6.1 Local flows still work from the checkout:
  - `pnpm dev` at the root, then `GET /maps?country=CO` lists the layers;
  - `Dockerfile.dev` with its bind mount;
  - `uv run python -m app.modules.layers.seed --target /tmp/maps-seed` still reads `app/maps`
- [x] 6.2 Run `openspec validate exclude-maps-from-api-image`
- [ ] 6.3 Open the PR into `dev`. In the description, put the before/after image and context sizes from 1.1 and 2.2, and the **BREAKING** note: `deploy.env` must set `STORAGE_ACCOUNT_NAME`
- [ ] 6.4 After merge, deploy to the test environment with `./azure/deploy.sh`. Confirm:
  - `/health` reports `mapsRoot=/mnt/maps` and writable;
  - the layers are listed;
  - one analysis runs;
  - the image in ACR is about 511 MB smaller
