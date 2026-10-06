## Context

`apps/api/Dockerfile.prod` has two stages:

- **builder:** `python:3.13-slim` plus `gdal-bin libgdal-dev libexpat1 gcc g++ python3-dev`, the GDAL include paths, uv, `uv sync --frozen --no-dev`, and `COPY ./app`;
- **runner:** `python:3.13-slim` plus `gdal-bin libgdal-dev libexpat1`, the uid/gid 10001 user, `COPY` of the venv and the app, then `RUN chown -R appuser ./app`.

`Dockerfile.dev` is one stage with the builder's packages and `uv sync --frozen` (dev group included), run with the source bind-mounted.

Measured on the deployed image (`monbo-api:83fa85d`, 1.69 GB):

| Layer | Size |
|---|---|
| runner `apt-get install` | 1.04 GB |
| `/opt/venv` | 527 MB |
| `app/` (plus a duplicate from `chown -R`) | 0.6 MB × 2 |
| base `python:3.13-slim` | 118 MB |

The biggest Debian packages in it are libboost1.83-dev (157 MB), gcc-14, libicu-dev, gfortran-14, cpp-14, libgdal36 and libperl5.40. Inside the venv, rasterio and pyogrio each carry their own libgdal 3.12.4 (`rasterio.libs` 67 MB, `pyogrio.libs` 80 MB), and that is what Python loads.

## Goals / Non-Goals

**Goals:**

- Remove the system packages the API never uses, from both Dockerfiles.
- Make "wheels only, no compiling" explicit, so it can't silently regress.
- Identical behaviour: same packages, same GDAL, same results.

**Non-Goals:**

- Removing geopandas or pyogrio (a code change, not an image change).
- A different base image (distroless, alpine), or trimming site-packages.
- The web image.

## Decisions

### D1. No system packages in either stage

Every lockfile entry resolves to a wheel for cp313 manylinux x86_64, or to a pure-Python wheel. This was checked against `apps/api/uv.lock`, the dev group included. So the builder needs no compiler or headers, and the runner needs no GDAL. Both `apt-get` blocks and the include-path variables go.

`Dockerfile.dev` has no fixed platform, so on Apple Silicon it builds for linux/arm64. Every entry also has a cp313 manylinux aarch64 wheel (or a pure-Python one), so the dev image needs no compilers there either.

**Correction found during verification:** `libexpat1` *is* needed. The GDAL bundled in rasterio's wheel links against the system `libexpat.so.1`; without it, `import rasterio` fails. Python's own `pyexpat` works without the package, which is why it first looked unneeded. Both Dockerfiles install `libexpat1` alone, with `--no-install-recommends`. It is the only system package left. A scan of every shared object in the venv found no other unresolved library. `libgeos` shows as unresolved when `ldd` inspects shapely's `libgeos_c` on its own, but it does so identically in the old image, and it resolves at runtime through the extension's RPATH.

**Why these packages were there.** They come from the API's first Dockerfile (`monbo-api/Dockerfile`, first commit, 2025-03-20: Python 3.11, `pip install -r requirements.txt` with rasterio 1.4.3, geopandas 1.0.1, shapely and pyproj). PR #3 carried them into `Dockerfile.dev` and `Dockerfile.prod`, adding compilers and the `CPLUS_INCLUDE_PATH` / `C_INCLUDE_PATH` variables. That is the usual recipe for building the `GDAL` Python bindings from source. But the API never depended on the `GDAL` package, and rasterio 1.4.3 already shipped wheels with GDAL bundled. The only project code that really needs a system GDAL is the offline `tools/update-gfw-tmf` script, whose `GDAL` binding compiles against it, and that script isn't part of the API image.

- **Alternative: keep `libgdal36` without `-dev`.** Rejected: still unused, because the wheels bundle their own GDAL.

### D2. `uv sync --no-build`

`--no-build` makes uv refuse to build any package from source. If a future dependency or bump has no wheel for this platform, the image build fails with a clear message. It doesn't quietly need compilers that are no longer there, and nobody re-adds them to the image by reflex.

`Dockerfile.dev` gets it too, so a developer finds the same problem locally.

### D3. `COPY --chown=appuser:appuser`

The runner copies the app from the builder already owned by `appuser`, instead of `COPY` followed by `RUN chown -R` (which rewrites the layer). The modes stay readable, and nothing needs `chmod 755`, because the app is code read by its owner. The venv stays root-owned and read-only for the app user, as today.

### D4. Verification by comparison with the current image

The current image (`83fa85d`) is the reference. Both images run side by side with the same Git layers mounted (`MAPS_ROOT`), and they are compared with:

- `tests.regression.parity`: farms parsing, analysis on every layer, validation;
- `/health`;
- a `generate-image` call, which exercises rasterio windowed reads and Pillow.

The full pytest suite runs inside the new dev container, which shows the dev group also works without system packages.

## Risks / Trade-offs

- **[Risk] A transitive library expected a system lib that happened to be present** (e.g. a font for Pillow, `libexpat`). → Mitigation: the D4 checks exercise the image paths. `pyexpat` was checked on the base. Pillow uses its bundled libs (`pillow.libs`).
- **[Risk] A future dependency without a wheel.** → Mitigation: `--no-build` fails the build explicitly. The fix is then a deliberate decision: add the build toolchain to the builder stage only, or pick another version.
- **[Trade-off] The Docker parity check is manual.** It runs once here, and afterwards the CD's revision checks plus the CI test suite guard the image.

## Migration Plan

1. Change both Dockerfiles. Build them, and compare sizes and layers.
2. Run the D4 checks locally.
3. Open a PR. After the merge, CD deploys the slimmer image to `dev`, with its verification and rollback.

**Rollback:** revert the commit; or redeploy the previous tag by hand (`TAG=<old> infra/deploy.sh dev --skip-build`, or the workflow's manual run).

## Open Questions

None.
