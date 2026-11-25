## 1. Dockerfiles

- [x] 1.1 `apps/api/Dockerfile.prod`:
  - **builder:** remove the `apt-get install` and the `CPLUS_INCLUDE_PATH` / `C_INCLUDE_PATH` env; use `uv sync --frozen --no-dev --no-build`;
  - **runner:** remove the `apt-get install`; `COPY --from=api-builder --chown=appuser:appuser /app/app ./app` replaces the copy plus `RUN chown -R … && chmod -R 755`;
  - keep the uid/gid 10001 user, the venv copy, `PATH`, `USER`, `EXPOSE` and `CMD`;
  - update the comments
- [x] 1.2 `apps/api/Dockerfile.dev`: remove the `apt-get install` and the include-path env; use `uv sync --frozen --no-build`

## 2. Verification (local, no Azure)

- [x] 2.1 Build the new prod image (`linux/amd64`). Record its size and layers against `monbo-api:83fa85d` (1.69 GB)
  - Result: **1.69 GB → 647 MB** (−62 %). Layers: base, `libexpat1` (about 0.4 MB), venv 527 MB, app 0.6 MB once (`--chown`, no duplicate).
- [x] 2.2 Inside it, rasterio and pyogrio report GDAL 3.12.4 from their bundled libs, `dpkg` shows no gdal or gcc, and `pyexpat` imports
  - rasterio and pyogrio report GDAL 3.12.4 from their bundled libs, and `rasterio._base` links to `rasterio.libs/libgdal-*.so`. There is no `gcc` or `gdalinfo`. **The first build, without `libexpat1`, failed `import rasterio` (`libexpat.so.1` missing)**, so `libexpat1` alone was added back (see design D1). shapely works (GEOS 3.13.1). The app is owned by uid 10001, the venv by root.
- [x] 2.3 Run the old and new images side by side, each with `app/maps` mounted read-only (`MAPS_ROOT=/maps`):
  - `/health` OK on both;
  - `uv run python -m tests.regression.parity http://localhost:<old> http://localhost:<new>` reports identical results
  - `/health` is OK on both (old `83fa85d` and new). `tests.regression.parity` between them reports **identical results on every regression farm and layer**.
- [x] 2.4 Smoke `POST /deforestation_analysis/generate-image` on the new image with a regression farm: a PNG comes back. Use the local Maps key, or note that the satellite background was skipped
  - `generate-image` for a Colombian polygon on GFW, with and without the satellite background (local Maps key): 200, `image/png`, 500×500. The PNGs are **byte-identical** between the old and new images.
- [x] 2.5 Build the new dev image and run the full pytest suite in it with the source bind-mounted
  - Dev image built natively for **arm64** (1.4 GB, down from 2.48 GB). In it: **258 passed, 1 skipped**, real-layer regression included. The skipped test is the template check (`apps/web` isn't mounted).
  - **Bug fixed along the way:** `tests/regression/test_regression.py` resolved the web template with `EXCEL_PATH.parents[4]`, written in monorepo-layout. With only `apps/api` mounted at `/app`, that raised `IndexError` at import and broke collection. It now searches up for the template and skips the test when it isn't there. On the host, 259 tests pass; ruff and black are clean.
- [x] 2.6 Check that `--no-build` fails loudly: add a sdist-only package in a scratch copy of `uv.lock` (or similar), then drop the scratch copy
  - In a scratch project depending on `sgmllib3k==1.0.0` (sdist only), `uv sync --frozen --no-build` fails with exit 2: "can't be installed because it is marked as `--no-build` but has no binary distribution".

## 3. Docs and wrap-up

- [x] 3.1 `CHANGELOG.md` Unreleased: the API image shrinks (before → after) and no longer installs system GDAL or compilers
- [x] 3.2 Run `openspec validate slim-api-image`
- [x] 3.3 Commit into #54 (the user chose to add it there; done in fbec667, CI green). After the merge, check that the CD deploy of `dev` verifies and that the image in the registry is smaller
  - Still open: after #54 merges, check that the CD deploy of `dev` verifies, and that the image in the registry is smaller.
  - Done on 2026-10-06. The CD deploy of `316206b` verified the new revisions. In the registry, the API image's compressed layers went from 526 MB (`83fa85d`) to **212 MB** (`316206b`), with 647 MB uncompressed.
