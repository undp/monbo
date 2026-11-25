## Why

The API's production image is 1.69 GB, and 1.04 GB of it is one layer nobody uses: `apt-get install gdal-bin libgdal-dev libexpat1` in the final stage. That pulls in libboost-dev, gcc, gfortran, libicu-dev and perl. The API never touches the system GDAL:

- rasterio 1.5.1 and pyogrio 0.13.0 ship their own libgdal (3.12.4) inside their wheels; in the deployed image, `rasterio._base` links to `rasterio.libs/libgdal-*.so`;
- the code neither imports `osgeo` nor runs GDAL binaries.

The build stage and `Dockerfile.dev` install the same packages plus compilers. Yet every dependency in `apps/api/uv.lock`, prod and dev, has a prebuilt wheel for CPython 3.13 on manylinux x86_64 (or is pure Python), so nothing is compiled.

Every deploy now runs from CI on each merge into `dev` (continuous-deployment). Each one pushes and pulls this image, and each cold start of the single API replica waits for it.

## What Changes

- **`apps/api/Dockerfile.prod`:**
  - drop the `apt-get install` from both stages, and the `CPLUS_INCLUDE_PATH` / `C_INCLUDE_PATH` variables;
  - install with `uv sync --frozen --no-dev --no-build`, so a future dependency that needs compiling fails the build loudly instead of silently needing compilers back;
  - copy the app with `COPY --chown`, removing the `RUN chown -R` that duplicated the `app/` layer;
  - unchanged: the uid/gid 10001 user, the non-root run, the venv at `/opt/venv`, the `CMD`, the uv pin.
- **`apps/api/Dockerfile.dev`:**
  - the same `apt-get` removal;
  - `uv sync --frozen --no-build`.
- **`libexpat1` stays, alone and without recommended packages** (about 400 kB). It is the one system library the wheels need: the GDAL bundled in rasterio's wheel links against `libexpat.so.1`. This was found during verification; Python's own `pyexpat` doesn't cover it.
- Expected result: about 650 MB (base 118 MB + venv about 530 MB + app).
- **Out of scope:**
  - dropping geopandas and pyogrio, the second GDAL copy (80 MB);
  - changing the base image;
  - trimming the venv.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `python-dependency-toolchain`: the API images install prebuilt wheels only (`--no-build`), with no system GDAL or compilers.

## Impact

- **Files:** `apps/api/Dockerfile.prod` and `apps/api/Dockerfile.dev`; `CHANGELOG.md`.
- **Behaviour:** none intended. The same Python packages and versions (same lock) and the same GDAL (the wheels') are used. This is verified by regression parity between the old and new images.
- **Deploys:** smaller pushes and pulls, faster cold starts. The first merge into `dev` after this change deploys it through `infra/deploy.sh`, with its revision checks and rollback.
