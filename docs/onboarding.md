# Monbo — Onboarding Guide

> Context document for developers joining the project.
> It covers three things — **(1) what Monbo is**, **(2) how it works**, and **(3) how the code is structured** — and ends with a **step-by-step guide to run it locally**.
>
> **Maintenance:** this document describes how the code behaves. When you change that behavior, update the relevant section in the same change so the guide stays accurate.

---

## 1. Initial context

**Monbo** is an application for **analyzing deforestation** and **generating due-diligence reports** that let organizations and producers demonstrate compliance with the **EUDR** (*European Union Deforestation Regulation*).

- **The problem it solves:** the EUDR requires anyone exporting certain agricultural commodities (coffee, cocoa, etc.) to the EU to prove that their production **does not come from land deforested after December 2020** (the *baseline* year). Gathering that evidence by hand — receiving farm coordinates, validating them, cross-referencing them against satellite imagery, and assembling a report — is slow and error-prone. Monbo automates that process.
- **Who it's for:** producers, cooperatives, exporters, and other stakeholders in sustainable supply chains.
- **Technical domain:** geospatial (farm polygons + satellite rasters of forest loss) + regulatory compliance.
- **Who maintains it:** the repository belongs to the **UNDP** (United Nations Development Programme) GitHub organization → `github.com/undp/monbo`. It is a digital public good developed in an international-cooperation context.

The application is organized into **3 product modules**, which are also the 3 main screens:

| Module | Name | What it does |
|---|---|---|
| **1** | Polygon and point validation | The user uploads their farm geometries (Excel / GeoJSON / WKT). Monbo validates that the geometries are correct and detects overlaps and duplicates. |
| **2** | Deforestation analysis | Cross-references each farm against satellite layers and computes **what percentage of the farm's area lost forest** after the baseline year. |
| **3** | Report generation | Produces a **due-diligence PDF** (plus a GeoJSON export) with the coordinates, analyzed periods, and evidence, ready for an EUDR audit. |

---

## 2. How it works

### 2.1 Overall architecture

Monbo is a **monorepo with two independent applications** plus an offline data script:

```
User ─▶ monbo-front (Next.js)  ──HTTP fetch──▶  monbo-api (FastAPI)  ──reads──▶  .tif rasters on disk
                                                       ▲
                                                       │ (generated offline, not at runtime)
                                           scripts/update-gfw-tmf (Google Earth Engine)
```

Key points for building the right mental model:

- **There is no database and no authentication.** The system is **stateless**: each analysis runs on demand and **nothing is persisted on the server**.
- **The "session state" lives only in the browser**, in a single React Context (`DataContext`) that wraps the whole app. Important consequence: **if the user refreshes the page, the entire flow is lost** (farms, validations, and results disappear and you are redirected home).
- **The backend serves the rasters from local disk** (`monbo-api/app/maps/layers/rasters/*.tif`), versioned with **Git LFS**.
- **CORS is fully open** (`allow_origins=["*"]`).

### 2.2 End-to-end flow (the user's journey)

The 3 modules are **not a rigid wizard**: the home page shows 3 cards, and both module 1 and module 2 have their own file-upload screen. What connects them is the shared state in `DataContext` (`monbo-front/src/context/DataContext.tsx`), which holds: `farmsData` (the source of truth), validation results, deforestation parameters/results, report parameters, and the `availableMaps` catalog (refreshed periodically via polling).

**Module 1 — Validation**
1. The user downloads an Excel template (`public/files/m1-upload-file-template-{en,es}.xlsx`) and uploads their file. The frontend reads it with `exceljs`/`xlsx` and validates required columns (ID, producer, country, coordinates, crop type, etc.).
2. The frontend sends the rows to **`POST /farms/parse?locale=`**. The backend parses coordinates (supports **WKT and GeoJSON**, `Point` and `Polygon`), interprets numbers according to the locale, auto-generates missing IDs, and — a non-obvious detail — **converts points into circles**: it uses the declared `area` as the radius, and if there is no area it uses a **default of 1 hectare**. It returns `FarmData` with the polygon already normalized.
3. The frontend stores the result (`setFarmsData`) and fires **`POST /polygons_validation/validate`** (sending only `{id, type, details}`). The backend rebuilds the polygons with **Shapely**, detects overlaps and invalid geometries, and marks each farm `VALID` / `NOT_VALID`.

**Module 2 — Deforestation analysis**
4. With the farms + the chosen maps, the frontend calls **`POST /deforestation_analysis/analize`** with `{farms:[{id,type,details}], maps:[ids]}`. *(The endpoint is spelled `analize`; the frontend contract matches that spelling exactly.)*
5. The backend iterates **per map × per farm** and returns `[{mapId, farmResults:[{farmId, value}]}]`, where `value` is a **ratio between 0 and 1** (or `null` if that farm failed). The "valid farms only" filter is **cosmetic on the frontend**: the backend always analyzes all farms.
6. The interactive map paints the rasters as PNG tiles generated on the fly via **`GET /deforestation_analysis/tiles/{map_id}/dynamic/{z}/{x}/{y}.png`**, over a Google Maps base layer.

**Module 3 — Report**
7. The user selects farms and maps; in the preview, an image is generated for each farm via **`POST /deforestation_analysis/generate-image`** (a PNG of the polygon with a red forest-loss overlay, with or without satellite background).
8. **The PDF is assembled 100% on the client** with `@react-pdf/renderer`; for multiple reports it is bundled into a ZIP (`jszip`). The backend does **not** generate the PDF; it only provides the images. A GeoJSON export is also available via **`GET /download-geojson`**.

### 2.3 The heart of the product: the deforestation calculation

This is the core concept worth understanding clearly.

- **Each "map" is a GeoTIFF raster that acts as a binary mask:** a pixel is `1` if that cell of terrain **lost forest after the baseline year**, and `0`/NoData otherwise. A pixel represents a real square of terrain (30×30 m in most layers, 10×10 m in Costa Rica; see `monbo-api/app/maps/index.json`).
- Those masks are produced by the **offline pipeline** `scripts/update-gfw-tmf/run.py` using Google Earth Engine (`data.gt(baseline_year).selfMask()` = "loss year > baseline → 1"). This script **does not run at runtime**; it is only used to regenerate the `.tif` files.
- **To cross-reference a polygon (vector, lat/lng) with a raster (pixel grid)**, in `deforestation_analysis/helpers.py`:
  1. Reproject the polygon to the raster's CRS.
  2. Crop the raster to the polygon's shape with `rasterio.mask.mask(..., all_touched=True)`. *(`all_touched=True` includes any pixel the polygon touches, even partially → it tends to over-count at the edges.)*
  3. Count the pixels whose value is exactly `1`.
- **The formula:**

  ```
  ratio = min(1.0, (deforested_pixels × pixel_area) / real_polygon_area)
  ```

  - `pixel_area = pixel_size²`, in **square meters** (`pixel_size` comes from the raster metadata, in meters).
  - `real_polygon_area` is **not** a pixel count: it is the real geodesic area, computed with an *Albers Equal Area* projection in `helpers/GeometryCalculator.py`.
  - The result is a **ratio from 0 to 1** (the UI shows it as a percentage). In one sentence: *"what fraction of this farm's real area falls on cells flagged as post-baseline forest loss?"*

### 2.4 Integrations and quirks

- **Google Maps Platform**: base map and satellite background (requires `NEXT_PUBLIC_GCP_MAPS_PLATFORM_API_KEY` on the frontend and credentials on the backend).
- **Google Earth Engine**: only in the offline raster-generation script.
- **No DB, no queues, no remote storage** at runtime.
- **Silently swallowed errors**: the analysis catches per-farm/per-map exceptions and returns `value: null` instead of failing; `calculate_polygon_area` returns `-1` for invalid geometries. A `null`/`-1` in the results means "could not be computed", not a crash.

---

## 3. Repository structure

It is a monorepo **without a workspace manager** (no Turborepo/Nx, no `pnpm-workspace.yaml`): each app is independent, with its own `package.json` and lockfile. Both apps are versioned together, which suggests joint releases.

```
monbo/
├── monbo-api/          # Backend  — FastAPI / Python
├── monbo-front/        # Frontend — Next.js 15 / React 19 / TypeScript
├── scripts/
│   └── update-gfw-tmf/ # Offline script (Google Earth Engine) that generates the .tif rasters
├── azure/              # Deployment manifests (Azure Container Apps)
├── docs/               # Documentation (partial — several files still empty/WIP)
├── pyproject.toml      # Python linter config (black, isort, ruff, mypy) for monbo-api
├── .gitattributes      # Declares Git LFS for the *.tif rasters
├── CHANGELOG.md · LICENSE.txt (LGPL v3) · README.md
```

### 3.1 Tech stack

| | Backend (`monbo-api`) | Frontend (`monbo-front`) |
|---|---|---|
| **Language** | Python 3.11 | TypeScript |
| **Framework** | FastAPI + Uvicorn | Next.js 15 (App Router) + React 19 |
| **Core** | Geospatial: `shapely`, `rasterio`, `geopandas`, `pyproj`, `mercantile`; images: `pillow` | UI: MUI 6 + Emotion; maps: `@vis.gl/react-google-maps` |
| **i18n** | bilingual metadata (en/es) | `i18next` (`[locale]` routes, en/es) |
| **Data/docs** | — | `@react-pdf/renderer`, `exceljs`/`xlsx`, `jszip`, `file-saver` |
| **Packages** | `pip` (there is a `package.json` "wrapper" only to expose scripts) | `pnpm` |
| **Tests** | `pytest` (in `tests/`) | — |
| **Container** | `Dockerfile.dev` / `Dockerfile.prod` (Python 3.11) | `Dockerfile.dev` / `Dockerfile.prod` (Node 20) |

### 3.2 Backend — `monbo-api/app/`

```
main.py                    # FastAPI bootstrap: CORS, router registration, endpoints /, /health, /download-geojson
modules/                   # One package per module, each with router.py + helpers.py + models.py
├── farms/                 #   POST /farms/parse — parses and normalizes uploaded farms (locale-aware)
├── polygons_validation/   #   POST /polygons_validation/validate — overlaps and invalid geometries (Shapely)
├── deforestation_analysis/#   POST /analize, GET /tiles/..., POST /generate-image (rasterio + Pillow)  ← core
└── maps/                  #   GET /maps — layer catalog from index.json + metadata
maps/                      # Static data: index.json, .tif rasters (Git LFS), bilingual metadata per layer/country
models/                    # Shared Pydantic schemas (farms, maps, polygons)
helpers/GeometryCalculator.py  # Geodesic area computation (Albers Equal Area)
utils/image_generation/    # Image generation (raster + geometry + Google Maps)
config/                    # env.py, constants.py, logger.py
tests/                     # pytest, mirrors the modules/ structure
```

### 3.3 Frontend — `monbo-front/src/`

```
app/[locale]/              # App Router; the language is a route segment (en/es)
├── page.tsx               #   Home: 3 module cards
├── polygons-validation/   #   Module 1 (+ its own upload-data)
├── deforestation-analysis/#   Module 2 (+ its own upload-data)
└── report-generation/     #   Module 3 (+ preview)
api/                       # fetch clients to the backend (farms.ts, polygonValidation.ts, deforestationAnalysis.ts)
context/DataContext.tsx    # Shared state for the ENTIRE flow (in memory)
components/
├── page/<module>/         #   Screen-specific components
└── reusable/              #   Generic inputs, modals, tables
config/env.ts              # Resolves API URLs and feature flags from NEXT_PUBLIC_* variables
hooks/ · interfaces/ · locales/{en,es}/ · utils/  # hooks, domain types, i18n dictionaries, utilities
```

> 🔎 **Important configuration detail:** in `config/env.ts` **each endpoint has its own environment variable** (`NEXT_PUBLIC_FARMS_PARSER_URL`, `NEXT_PUBLIC_POLYGON_VALIDATION_URL`, `NEXT_PUBLIC_DEFORESTATION_ANALYSIS_URL`, …), each falling back to `${NEXT_PUBLIC_API_URL}/...`. In other words, **each module can point to a different backend**. In production, placeholders (`__NEXT_PUBLIC_API_URL__`) are used and replaced at container runtime — it is not pure build-time (see `docs/nextjs_production_start.md`).

---

## 4. Running it locally (step by step)

This is a generic walkthrough, from `git clone` to seeing the app at `http://localhost:3000`. There is **no `docker-compose` or `Makefile`**: you run the backend and the frontend separately, in two terminals.

### 4.0 Prerequisites

Install these on your machine first (examples for Fedora; adjust for your OS):

| Tool | Version | Why |
|---|---|---|
| **git** + **git-lfs** | any recent | git-lfs is required to download the rasters (it is **not** installed by default) |
| **Python** | **3.11** | backend |
| **Node.js** | **20** | frontend (only enforced in Docker; use 20 to match) |
| **pnpm** | latest | package manager for both apps |
| A **Google Maps Platform API key** | — | so the map actually renders in module 2/3 |

```bash
# Fedora           # Debian/Ubuntu            # macOS (Homebrew)
sudo dnf install \  sudo apt install \         brew install \
  git git-lfs        git git-lfs                git git-lfs python@3.11 node pnpm
# Python 3.11 + Node 20 + pnpm: install via your OS package manager, pyenv/nvm, or corepack
```

### 4.1 Clone the repo and download the rasters (Git LFS)

```bash
git clone https://github.com/undp/monbo.git
cd monbo

git lfs install          # one-time: registers the git-lfs hooks for your user
git lfs pull             # downloads the real .tif rasters (pointers → ~hundreds of MB)
```

> 🔴 **This step is mandatory.** The `.tif` files committed to the repo are ~130-byte LFS pointers. Without `git lfs pull`, module 2 fails when it tries to open the rasters.
> If `git lfs pull` prints `'lfs' is not a git command`, git-lfs is not installed — go back to 4.0.

### 4.2 Backend — terminal 1 (`monbo-api`, port 8000)

```bash
cd monbo-api

# 1. Create the .env from the template
cp .env.template .env
#    Then edit .env:
#      GCP_MAPS_PLATFORM_API_KEY=<your Google Maps key>       # needed for the satellite background
#      GCP_MAPS_PLATFORM_SIGNATURE_SECRET=<your secret>       # optional for local dev
#      OVERLAP_THRESHOLD_PERCENTAGE=1

# 2. Install dependencies and run the dev server (hot reload).
#    Dependencies are managed with uv (https://docs.astral.sh/uv/). uv creates and
#    manages the Python 3.11 virtual environment automatically (pinned via
#    .python-version), so no manual `venv` step is needed.
pnpm install                        # this simply runs: uv sync
pnpm dev                            # → uv run fastapi dev ./app/main.py  (http://localhost:8000)
```

> `pnpm` in the backend is just a thin wrapper over `package.json` scripts, which delegate to uv. If you'd rather skip it: `uv sync` then `uv run fastapi dev ./app/main.py`.
> Verify the backend is up: open **`http://localhost:8000/docs`** (interactive Swagger UI).

### 4.3 Frontend — terminal 2 (`monbo-front`, port 3000)

```bash
cd monbo-front

# 1. Create the .env.development from the example (keep the exact name — Next.js loads it by convention)
cp .env.development.example .env.development
#    Minimum required values:
#      NEXT_PUBLIC_API_URL=http://localhost:8000
#      NEXT_PUBLIC_GCP_MAPS_PLATFORM_API_KEY=<your Google Maps key>
#    The rest have safe defaults for local dev.

# 2. Install dependencies and run the dev server
pnpm install
pnpm dev                            # → next dev --turbo  (http://localhost:3000)
```

### 4.4 Open the app

Go to **`http://localhost:3000`**. You should see the home page with the 3 module cards. To exercise the full flow, download the Excel template from module 1, fill in a couple of farms, and upload it.

> If the map area in module 2/3 is blank, your `NEXT_PUBLIC_GCP_MAPS_PLATFORM_API_KEY` is missing or invalid. If module 2 errors out computing deforestation, you probably skipped `git lfs pull` (4.1).

### 4.5 Suggested reading order

The backend is smaller and concentrates the product logic; start there:

1. `monbo-api/app/main.py` → the endpoint map.
2. `monbo-api/app/maps/index.json` → what a "map"/raster is (pixel_size, baseline, countries).
3. `deforestation_analysis/router.py` → `helpers.py` → `helpers/GeometryCalculator.py` → **the core** (§2.3).
4. `scripts/update-gfw-tmf/run.py` → where the rasters come from and why `==1` means deforestation.
5. Frontend: `context/DataContext.tsx` (the state) → `api/*.ts` (the contracts) → one full screen end to end.

### 4.6 A good first exercise (low risk, high learning)

Trace a single farm through the whole pipeline to internalize §2.2 and §2.3 — this touches the core paths without changing any behavior, so it's safe on day one:

1. Run the backend test suite (`pnpm test` in `monbo-api`) and read `tests/modules/deforestation_analysis/test_helpers.py` to see the deforestation math exercised in isolation.
2. From Swagger (`http://localhost:8000/docs`), call `POST /farms/parse` with one farm, then feed its output into `POST /polygons_validation/validate` and `POST /deforestation_analysis/analize`, watching how the payload changes at each step.
3. In the frontend, add a log (or breakpoint) in `context/DataContext.tsx` and follow the same farm across the three screens.

### 4.7 Gotchas (things that surprise newcomers)

- 🔴 **Deforestation analysis won't work without the Git LFS rasters.** git-lfs is not installed by default: install it, then run `git lfs install` and `git lfs pull` (see 4.0–4.1).
- 🔄 **Refreshing the browser wipes the whole flow** (state lives only in frontend memory).
- 🧩 **Each frontend module can point to a different backend** (one env var per endpoint, all falling back to `NEXT_PUBLIC_API_URL`).
- ✍️ **The analysis endpoint is spelled `analize`** — match that spelling exactly when calling it.
- 🤫 A `value: null` (or area `-1`) in the results means "could not be computed", not a crash.
