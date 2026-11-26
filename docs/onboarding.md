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
User ─▶ monbo-front (Next.js)  ──HTTP fetch──▶  monbo-api (FastAPI)  ──reads──▶  layers in MAPS_ROOT
                                                                     ──appends─▶  usage events in USAGE_DIR
Admin ─▶ monbo-front /admin    ──HTTP fetch──▶  monbo-api /admin     ──writes─▶  (Git copy locally,
                                                                                 Azure Files share in Azure)
                                                       ▲
                                                       │ (binary rasters prepared offline, not at runtime)
                                           tools/update-gfw-tmf (Google Earth Engine)
```

Key points for building the right mental model:

- **There is no database and no user accounts.** Analyses are **stateless**: each one runs on demand and **nothing about the user's farms is persisted on the server**. The server-side state is the deforestation layers, which each country's **layers admin** edits (one passkey per country; see §4.8 and `docs/maps.md`), and the anonymous **usage events**: one JSON line per upload, validation and analysis (recorded by the API) and per report requested or downloaded (sent by the browser to the public `POST /events`), appended under `USAGE_DIR` (in Azure, `usage/` on the layers share). An event carries an anonymous per-tab session ID, the country and counts, never farm data; without `USAGE_DIR`, events only go to stdout.
- **The "session state" lives only in the browser**, in a single React Context (`DataContext`) that wraps the whole app. Important consequence: **if the user refreshes the page, the entire flow is lost** (farms, validations, and results disappear and you are redirected home). Changing the language does keep it: the language is the root layout's `[locale]` segment, so switching it remounts `DataProvider`, and the flow is kept in a module-level `keptState` that the remounted provider picks up. Logic that runs once per mount inside the provider runs again after a language change, so it must not assume a fresh flow. The remounted provider fetches `GET /maps` in the new language and swaps the analysed layers, and the report's chosen layers, for the listed ones by id, so the layer texts (name, alias, source, coverage, considerations…) follow the UI language in the layer details modal, the PDF and the exports. A layer hidden after the analysis is no longer listed in any language, so once an analysis has results the web also fetches `GET /maps` once in each UI language it hasn't seen yet and keeps every layer's texts per language and country in a module-level store (`keptLayerTexts`, next to `keptState`); a hidden layer takes its texts in the current language from there, or keeps its last ones if that fetch failed. Only texts change: a language change never re-runs the analysis, and the hidden layer's calculation fields stay those of the analysis.
- **The backend reads the layers from `MAPS_ROOT`**: by default the Git-tracked `apps/api/app/maps` (rasters in **Git LFS**, flat layout, read-only); in Azure, the per-country layout on an **Azure Files share** (`/mnt/maps`), which the admin writes to. Each country has its own folder and numbers its layers from 0, so analysis, tiles and report images send the country with the layer id.
- **CORS is open to any origin** (`allow_origins=["*"]`, no credentials). The admin routes additionally check the `Origin` against `ADMIN_ALLOWED_ORIGIN` and require a session token. Admin routes only reach the session's country, except `GET /admin/usage`, which gives every admin the usage figures of all countries.

The Azure resources, how the API reads the rasters and how the per-country admin works are explained in [`architecture.md`](architecture.md).

### 2.2 End-to-end flow (the user's journey)

**Everything starts on the start page** (`/`, `components/page/landing/`). It shows the three steps of the flow and a start bar with one pill per country with at least one published layer (from `GET /countries`), each with the country's silhouette (`utils/countryShapes.json`, generated by `apps/web/scripts/generate-country-shapes.mjs`). Colombia is preselected; "Empezar en {país}" and step 1 open module 1, step 2 opens module 2 directly. `/home` only redirects to `/`, permanently (308). The header (dark over the hero on the start page, white elsewhere) links "Inicio", "Análisis" (which resumes the flow) and "Metodología" (`/documentation`); "Inicio" and the logo go back to the start page. The country is one ISO code kept in `DataContext` (`selectedCountry`, persisted in `sessionStorage` for the tab); the module pages redirect to `/` without it, and the layer lists only show that country's layers. The header shows it next to the language menu on every page but the start page: before a territorial analysis exists, changing it keeps the farms and validation results, updates each farm's country, and clears the selected layers. After an analysis, changing it means starting over (a modal asks, and accepting clears every loaded result). All country changes go through `hooks/useCountryChange.ts`.

The 3 modules are **not a rigid wizard**: the start page offers steps 1 and 2 as entry points, and both module 1 and module 2 have their own file-upload screen. What connects them is the shared state in `DataContext` (`apps/web/src/context/DataContext.tsx`), which holds: the selected country, `farmsData` (the source of truth), validation results, territorial analysis parameters/results (`territorialAnalysisParams`, `territorialAnalysisResults`), report parameters, and the `availableMaps` catalog (refreshed periodically via polling).

Every page of the three modules shows the **flow header** (`components/page/flow/`, rendered by each module's `layout.tsx`):
- the analysis country, with a "Change country" link to the start page;
- a stepper through the stages: Validación → Análisis territorial → Reporte.

Each stage's state is a pure function of the route and `DataContext` (`utils/flowStages.ts`):
- the current stage isn't a control: it opens no dialog;
- stage 2 can always be opened from another stage, even without validating first. It has three pages:
  - the upload (`/territorial-analysis/upload-data`), where a direct entry starts. It is stage 1's upload, and "Continuar" goes on to the layers without analysing;
  - the layers (`/territorial-analysis/layers`), where stage 2 goes once farms are loaded. A banner says which polygons the analysis uses. After a validation it lets the user choose the valid ones or all of them, and "Ver polígonos" goes back to the validation results, or to the upload list without one. The page shows the layers grouped by category and starts the analysis only from "Analizar" (or to recalculate an outdated analysis), never just because it opened. What the page edits is a draft (`analysisDraft` in `DataContext`): the results, the map and the report keep the subset and layers they were analysed with (`territorialAnalysisParams`) until a new analysis succeeds, and a layer hidden after it was chosen is never sent;
  - the results (`/territorial-analysis`);
- stage 3 needs analysis results. It is one page (`/report-generation`; the old `/report-generation/preview` redirects there, in `proxy.tsx`), and no dialog stands before it. Its first visit for an analysis ticks every polygon and every analysed layer (`reportGenerationParams.seeded`); later visits keep the user's choice, and a new analysis, new farms or an invalidated analysis drop it;
- on stage 2, "Continuar" with an unchanged list keeps the farms and their results; with a changed one it parses the list again and drops the validation and the analysis. `DataContext` counts the list's changes (`uploadSourcesRevision`) and remembers the count the farms were parsed from (`farmsSourcesRevision`). Stage 1's "Validar" always parses and validates again, and drops the analysis. Emptying the list drops nothing by itself: both upload pages keep their bar, with the button off, until the list has a farm again.

The results pages of modules 1 and 2 end with a "Next stage" card: module 1's goes to module 2's layers page, and module 2's goes to the report page. The application header has no module buttons.

**Module 1 — Validation**
1. The upload step (`components/page/uploadData/`, shared by modules 1 and 2) offers four ways to bring the farms, as methods to choose from with a "how to" panel for the selected one, and builds **one list of sources** from any mix of them (`useUploadSources` + `utils/uploadSources.ts`):
   - **Excel template** (`public/files/m1-upload-file-template-{en,es}.xlsx`), with each farm's coordinates in a cell. The frontend reads it with `exceljs`/`xlsx` and validates the required columns (`utils/excel.ts`).
   - **Geo file**, carrying the farms' data (GeoJSON, KML, KMZ or zipped Shapefile): the browser sends the file to **`POST /farms/import`** (`modules/farms/geo_import.py`, GDAL through pyogrio), which answers each feature's attributes and its geometry as WKT in EPSG:4326, holes and MultiPolygons kept. The farms' data is read from fixed attribute names (`utils/geoFile.ts`).
   - **Geo file + Excel**: the same import, joined by farm ID to the production Excel, which has its own template without coordinate columns (`utils/geoFileJoin.ts`).
   - **Drawing on the map**: a modal with our own drawing tool on Google Maps (`components/page/uploadData/manualFarm/`, with the rules in `utils/drawing.ts`).

   Nothing is sent on drop: the list shows one row per farm (ID, producer, crop, production, type, origin) with a delete button, plus a notice per file with its problems and file-level actions; the upload starts when the user presses the step's button. A row deleted from a file is kept out by its position in that file (`removedRows`), also when the file is read again, and so are its problems: deleting the rows with problems of an Excel, or of a geo file read from its attributes, clears the file's notice (`utils/rowProblems.ts`, see `docs/architecture.md`, "How farms come in"). The list belongs to the flow, not to a stage: both upload pages show and edit the same list, kept in `DataContext` (`uploadSources`), so "Agregar más polígonos" on the results and "Ver polígonos" on stage 2 find it again. Neither page parses or validates it on entry. No source carries a country: every row gets the selected country before it is sent (an old template's country column, or a geo file's `ProducerCountry`/`PAIS`, must match it, and the listed files are checked again if the country changes).
2. The frontend sends the rows to **`POST /farms/parse?locale=`**. The backend parses coordinates (supports **WKT and GeoJSON**, `Point` and `Polygon`), interprets numbers according to the locale, auto-generates missing IDs, and — a non-obvious detail — **converts points into circles**: it uses the declared `area` as the radius, and if there is no area it uses a **default of 1 hectare**. It returns `FarmData` with the polygon already normalized.
   Each row carries its `origin` (the method and file name); `/farms/parse` echoes it back in `FarmData` without storing it, so the results can show where each farm came from.
3. The frontend stores the result (`setFarmsData`) and fires **`POST /polygons_validation/validate`** (sending only `{id, type, details}`). The backend rebuilds the polygons with **Shapely**, detects overlaps and invalid geometries, and marks each farm `VALID` / `NOT_VALID`. The results page is one table with a status per farm (`utils/validationResults.ts`); "Revisar" on an overlapping farm opens all its overlaps, where it can be validated manually (`VALID_MANUALLY`, browser-only). After "Agregar más polígonos", every farm is validated again and a manual validation survives only if the farm overlaps exactly the same farms as before.

**Module 2 — Deforestation analysis**
4. With the farms + the chosen maps, the frontend calls **`POST /layer_analysis/analyze`** with `{country, farms:[{id,type,details}], maps:[ids]}` (layer ids are numbered within each country).
5. The backend iterates **per map × per farm** and returns `[{mapId, version, farmResults:[{farmId, value}]}]`, where `version` is the layer's raster version the results were computed on, and `value` is a **ratio between 0 and 1** (or `null` if that farm failed). The "valid farms only" filter is **cosmetic on the frontend**: the backend always analyzes all farms.
   The web loads the country's categories (`GET /categories`) together with its layers (`availableCategories` in `DataContext`) and reads each layer's results with its category's rule (polarity and threshold, `categoryRule` in `utils/layerResults.ts`). The results page summarises each category, groups the table's layer columns by category and names the map groups with the category's labels. A layer whose category is no longer listed shows "Sin dato": the web never guesses its rule. The PDF report and the Excel and GeoJSON exports read them the same way (step 8).
6. The interactive map paints the rasters as PNG tiles generated on the fly via **`GET /layer_analysis/tiles/{country}/{map_id}/dynamic/{z}/{x}/{y}.png`**, over a Google Maps base layer.
   If an admin replaces a selected raster, changes its calculation fields, moves it
   to another category or changes how its category reads a result (polarity or
   `temporal`) while the page is open, the browser discards the earlier percentages
   and recalculates them before showing the updated map or report. A category's
   threshold or labels apply at once, without recalculating.

**Module 3 — Report**
7. On the report page the user ticks the polygons (with a search, "Seleccionar todos" and an icon per category coloured by the polygon's worst result) and the report's layers in the sidebar. Nothing renders until "Generar vista previa": the preview is of the choice at that moment, and a later change leaves it on screen with a stale notice and "Actualizar vista previa". "Descargar" always takes the current choice, with or without a preview, and opens the "Formato" modal: one PDF or a PDF per polygon (only the ZIP for a large report, one PDF for one polygon), and the choice's GeoJSON. For the PDF, an image is generated for each farm and map via **`POST /layer_analysis/generate-image`** (a 640×420 JPEG, the aspect ratio of the map box on the PDF's map pages, with a red forest-loss overlay and the farm's polygon drawn on top of it, with or without satellite background; the API fetches each farm's satellite image from Google once and caches it for the other maps). The images are fetched once per selection (`ReportProvider`, keyed by `imagesKey`) and shared by the preview and both downloads. The rendered PDFs are keyed by the selection plus its layers' texts, so after a language change the preview shows the stale notice and "Descargar" renders again in the new language, reusing the images. The frontend sends the analysed `version`; if the layer has a newer raster the API answers 409 and the frontend re-runs the analysis, so a report never mixes two rasters.
8. **The PDF is assembled 100% on the client** with `@react-pdf/renderer`, in a Web Worker (`src/workers/reportPdf.worker.tsx`) so the page stays responsive: the preview is the worker's blob shown in an `iframe`, and the complete report is pre-rendered so "Download" saves it at once; for multiple reports it is bundled into a ZIP (`jszip`). The backend does **not** generate the PDF; it only provides the images. A GeoJSON export is also available via **`GET /download-geojson`**.
   The report reads each result with its layer's category (`GET /categories`, kept in `DataContext` with the layers): a cover without results (the categories included and an index), one sheet per farm with every layer's result grouped by category ("Sin dato" for `null`), a map page per layer with a result, a methodology page and each layer's scope and limits. The Excel and GeoJSON exports name the category and the layer in their headers, in the user's language.

### 2.3 The heart of the product: the deforestation calculation

This is the core concept worth understanding clearly.

- **Each "map" is a GeoTIFF raster that acts as a binary mask:** a pixel is `1` if that cell of terrain **lost forest after the baseline year**, and `0`/NoData otherwise. A pixel represents a real square of terrain (30×30 m in most layers, 10×10 m in Costa Rica; see `apps/api/app/maps/index.json`).
- Those masks are produced by the **offline pipeline** `tools/update-gfw-tmf/run.py` using Google Earth Engine (`data.gt(baseline_year).selfMask()` = "loss year > baseline → 1"). This script **does not run at runtime**; it is only used to regenerate the `.tif` files.
- Each layer belongs to a **category** of its country, which says how its result reads (polarity, threshold, wording). Every layer in the repo is in the built-in `deforestation` category. See `docs/maps.md`, "Categories".
- **To cross-reference a polygon (vector, lat/lng) with a raster (pixel grid)**, in `layer_analysis/helpers.py`:
  1. Reproject the polygon to the raster's CRS.
  2. Crop the raster to the polygon's shape with `rasterio.mask.mask(..., all_touched=True)`. *(`all_touched=True` includes any pixel the polygon touches, even partially, so that the next step sees every pixel the farm overlaps.)*
  3. Take the pixels whose value is exactly `1`, and build each one's square from the raster's transform.
  4. Intersect those squares with the polygon (vectorized with `shapely`) and add up their areas.
- **The formula** (`get_loss_area_fraction`):

  ```
  ratio = Σ area(loss_pixel ∩ polygon) / area(polygon)
  ```

  - Both areas are in the **raster's CRS**: exact in a projected one (UTM), and in EPSG:4326 the ratio of two areas a few hundred metres across is the same as on the ground. The layer's `pixel_size` doesn't enter it.
  - A pixel the farm only grazes adds that sliver, not a whole pixel. Before October 2026 each touched loss pixel counted in full (`pixels × pixel_size² / area`, capped at 1), which over-estimated small farms: one of 2.7 ha with 67% of its area on loss showed 100%.
  - Whether there is a ratio at all is decided by the real geodesic area, measured on the WGS84 ellipsoid (`helpers/GeometryCalculator.py`): an empty or invalid polygon has none (`null`).
  - The result is a **ratio from 0 to 1** (the UI shows it as a percentage). In one sentence: *"what fraction of this farm's real area falls on cells flagged as post-baseline forest loss?"*
  - The full method, with an example and how each pixel's piece is measured, is in [`deforestation_calculation.md`](deforestation_calculation.md).

### 2.4 Integrations and quirks

- **Google Maps Platform**: base map and satellite background (requires `NEXT_PUBLIC_GCP_MAPS_PLATFORM_API_KEY` on the frontend and credentials on the backend).
- **Google Earth Engine**: only in the offline raster-generation script.
- **No DB and no queues.** In Azure the layers live on an **Azure Files share**; raster uploads from the admin are processed as in-process background jobs, one at a time.
- **Raster ingestion checks the layer's data.** Nodata cannot be `1` (it would read
  as loss), and the area of the configured `pixel_size` must be within 5% of the raster's cell
  area at every latitude it covers. The same size check applies when an admin edits
  a layer with a raster.
- **Silently swallowed errors**: the analysis catches per-farm/per-map exceptions and returns `value: null` instead of failing; `calculate_polygon_area` returns `-1` for invalid geometries. A `null`/`-1` in the results means "could not be computed", not a crash.

---

## 3. Repository structure

It is a monorepo **without a workspace manager** (no Turborepo/Nx, no `pnpm-workspace.yaml`): each app is independent, with its own `package.json` and lockfile. Both apps are versioned together, which suggests joint releases.

```
monbo/
├── apps/
│   ├── api/            # Backend  — FastAPI / Python (package `monbo-api`)
│   └── web/            # Frontend — Next.js / React / TypeScript (package `monbo-front`)
├── tools/
│   ├── update-gfw-tmf/ # Offline script (Google Earth Engine) that generates the .tif rasters
│   └── layers-ops/     # Seed the Azure share and manage countries (operators only)
├── infra/              # Terraform for Azure (terraform/platform, terraform/apps) and deploy.sh
├── docs/               # Documentation (partial — several files still empty/WIP)
├── pyproject.toml      # Python linter config (black, isort, ruff, mypy) for apps/api
├── .gitattributes      # Declares Git LFS for the *.tif rasters
├── CHANGELOG.md · LICENSE.txt (LGPL v3) · README.md
```

### 3.1 Tech stack

| | Backend (`apps/api`) | Frontend (`apps/web`) |
|---|---|---|
| **Language** | Python 3.13 | TypeScript |
| **Framework** | FastAPI + Uvicorn | Next.js 15 (App Router) + React 19 |
| **Core** | Geospatial: `shapely`, `rasterio`, `geopandas`, `pyproj`, `mercantile`; images: `pillow` | UI: MUI 6 + Emotion; maps: `@vis.gl/react-google-maps` |
| **i18n** | bilingual metadata (en/es) | `i18next` (`[locale]` routes, en/es) |
| **Data/docs** | — | `@react-pdf/renderer`, `exceljs`/`xlsx`, `jszip`, `file-saver` |
| **Packages** | `pip` (there is a `package.json` "wrapper" only to expose scripts) | `pnpm` |
| **Tests** | `pytest` (in `tests/`) | Vitest + Testing Library (`src/**/*.test.ts(x)`, helpers in `src/test/`) |
| **Container** | `Dockerfile.dev` / `Dockerfile.prod` (Python 3.13) | `Dockerfile.dev` / `Dockerfile.prod` (Node 24) |

### 3.2 Backend — `apps/api/app/`

```
main.py                    # FastAPI bootstrap: CORS, router registration, endpoints /, /health, /health/live, /download-geojson
modules/                   # One package per module, each with router.py + helpers.py + models.py
├── farms/                 #   POST /farms/parse — parses and normalizes uploaded farms (locale-aware); POST /farms/import — reads a geo file (GeoJSON, KML, KMZ, zipped Shapefile) into features with WKT geometries
├── polygons_validation/   #   POST /polygons_validation/validate — overlaps and invalid geometries (Shapely)
├── layer_analysis/        #   POST /layer_analysis/analyze, GET /tiles/..., POST /generate-image (rasterio + Pillow)  ← core
├── maps/                  #   GET /maps (?country=) and GET /countries — the published layers and their countries
├── layers/                #   LayersRoot/LayerStore (read/write MAPS_ROOT), raster checks + COG conversion, seed and migration commands
├── usage/                 #   POST /events (report events from the browser), the middleware that records uploads, validations and analyses, the USAGE_DIR writer and the monthly rollups
└── admin/                 #   /admin/* — per-country passkey login, layer and category CRUD, raster uploads (only when configured); GET /admin/usage, every country's usage; countries CLI
maps/                      # Git-tracked layers: index.json, .tif rasters (Git LFS), bilingual metadata per layer
models/                    # Shared Pydantic schemas (farms, maps, polygons)
helpers/GeometryCalculator.py  # Geodesic area computation (WGS84 ellipsoid, pyproj.Geod)
utils/image_generation/    # Image generation (raster + geometry + Google Maps)
config/                    # env.py, constants.py, logger.py
tests/                     # pytest, mirrors the modules/ structure; tests/regression/ runs a fixed set of farms end to end
```

### 3.3 Frontend — `apps/web/src/`

```
app/[locale]/              # App Router; the language is a route segment (en/es)
├── page.tsx               #   Start page: the 3 steps and the country pills (/home redirects here, in proxy.tsx)
├── polygons-validation/   #   Module 1 (+ its own upload-data)
├── territorial-analysis/  #   Module 2: upload-data/, layers/ and the results; /deforestation-analysis redirects here, in proxy.tsx
├── report-generation/     #   Module 3: one page with the choices and the preview
└── admin/                 #   Admin: layers (login, layer list, create/edit, raster upload) and usage/ (every country's usage figures); not linked from the public pages
api/                       # fetch clients to the backend (farms.ts, polygonValidation.ts, layerAnalysis.ts)
context/DataContext.tsx    # Shared state for the ENTIRE flow (in memory)
components/
├── page/<module>/         #   Screen-specific components
└── reusable/              #   Generic inputs, modals, tables
config/env.ts              # Resolves API URLs and feature flags from NEXT_PUBLIC_* variables
config/theme.ts            # MUI theme; every result color (ok / flagged / no data, summary meter, map legend) lives in its `result` palette, exported as RESULT_COLORS for the PDF
hooks/ · interfaces/ · locales/{en,es}/ · utils/  # hooks, domain types, i18n dictionaries, utilities
```

> 🔎 **Important configuration detail:** in `config/env.ts` **each endpoint has its own environment variable** (`NEXT_PUBLIC_FARMS_PARSER_URL`, `NEXT_PUBLIC_POLYGON_VALIDATION_URL`, `NEXT_PUBLIC_LAYER_ANALYSIS_URL`, …), each falling back to `${NEXT_PUBLIC_API_URL}/...`. In other words, **each module can point to a different backend**. In production, placeholders (`__NEXT_PUBLIC_API_URL__`) are used and replaced at container runtime — it is not pure build-time (see `docs/nextjs_production_start.md`).

---

## 4. Running it locally (step by step)

This is a generic walkthrough, from `git clone` to seeing the app at `http://localhost:3000`. There is **no `docker-compose` or `Makefile`**: you run the backend and the frontend separately, in two terminals.

### 4.0 Prerequisites

Install these on your machine first (examples for Fedora; adjust for your OS):

| Tool | Version | Why |
|---|---|---|
| **git** + **git-lfs** | any recent | git-lfs is required to download the rasters (it is **not** installed by default) |
| **Python** | **3.13** | backend |
| **Node.js** | **24** | Both the frontend package and the root orchestrator require Node 24 (`engines.node >=24` in `apps/web/package.json`; the pinned `concurrently` needs ≥22). Docker images are `node:24-alpine` and CI pins `actions/setup-node` to 24, so 24 is what the app is built and shipped on. `engine-strict` is off, so an older interpreter warns rather than fails — but the warning is the only thing standing between you and a mismatch, so match it. |
| **pnpm** | latest | package manager for both apps |
| A **Google Maps Platform API key** | — | so the map actually renders in module 2/3 |

```bash
# Fedora           # Debian/Ubuntu            # macOS (Homebrew)
sudo dnf install \  sudo apt install \         brew install \
  git git-lfs        git git-lfs                git git-lfs python@3.13 node pnpm
# Python 3.13 + Node 24 + pnpm: install via your OS package manager, pyenv/nvm, or corepack
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

**Branches.** A fresh clone checks out `dev`, the default and integration branch. Branch from `dev`, and open pull requests against `dev`: that is GitHub's default, and both `dev` and `main` reject direct pushes. `main` holds the latest release and only changes through a release or a hotfix ([`branch_protection.md`](branch_protection.md#release-and-hotfix-flow)). If you cloned before `dev` became the default, point your clone at the new default once:

```bash
git remote set-head origin -a   # origin/HEAD → origin/dev
```

**Clones from before `apps/`.** The apps used to live in `monbo-api/` and `monbo-front/`, and the GFW/TMF script in `scripts/update-gfw-tmf/`. Git moves the tracked files, but your ignored ones stay in the old folders. Move your `.env` files to `apps/api/` and `apps/web/`, delete the old folders, and reinstall: `uv sync` in `apps/api` and `pnpm install` in `apps/web`. A virtualenv can't be moved, because it records its absolute path.

**Worktrees.** A new `git worktree` (or a Conductor or T3 Code workspace) starts without the git-ignored env files. Once the main checkout has them (4.2, 4.3 and `infra/envs/dev.secrets.env`), run `pnpm setup:worktree` from the worktree: `scripts/setup-worktree.sh` copies `apps/api/.env`, `apps/web/.env.development` and `infra/envs/dev.secrets.env` from the main checkout, keeping files that already exist unless you pass `--force`. Then install dependencies and pull the rasters as usual.

### 4.2 Backend — terminal 1 (`apps/api`, port 8000)

```bash
cd apps/api

# 1. Create the .env from the template
cp .env.template .env
#    Then edit .env:
#      GCP_MAPS_PLATFORM_API_KEY=<your Google Maps key>       # needed for the satellite background
#      GCP_MAPS_PLATFORM_SIGNATURE_SECRET=<your secret>       # optional for local dev
#      OVERLAP_THRESHOLD_PERCENTAGE=1
#      DEFORESTATION_THRESHOLD_PERCENTAGE=1
#    The frontend reads both thresholds from the API (GET /config); they are set only here.

# 2. Install dependencies and run the dev server (hot reload).
#    Dependencies are managed with uv (https://docs.astral.sh/uv/). uv creates and
#    manages the Python 3.13 virtual environment automatically (pinned via
#    .python-version), so no manual `venv` step is needed.
pnpm install                        # this simply runs: uv sync
pnpm dev                            # → uv run fastapi dev ./app/main.py  (http://localhost:8000)
```

> `pnpm` in the backend is just a thin wrapper over `package.json` scripts, which delegate to uv. If you'd rather skip it: `uv sync` then `uv run fastapi dev ./app/main.py`.
> Verify the backend is up: open **`http://localhost:8000/docs`** (interactive Swagger UI).

### 4.3 Frontend — terminal 2 (`apps/web`, port 3000)

```bash
cd apps/web

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

Go to **`http://localhost:3000`**. You should see the start page with the three steps and the Colombia, Costa Rica and Ecuador pills; pick one and press "Empezar en …" to open module 1. To exercise the full flow, download the Excel template or one of the example files from module 1's upload step, list it, and press the step's button.

> If the maps show Google's "Oops! Something went wrong" instead of the base map (and the console logs `InvalidKeyMapError`), your `NEXT_PUBLIC_GCP_MAPS_PLATFORM_API_KEY` is missing or invalid. A missing key is the same case: `config/env.ts` falls back to the `__NEXT_PUBLIC_GCP_MAPS_PLATFORM_API_KEY__` placeholder, which Google rejects. Google then disables its Maps API in that tab, but the rest of the flow keeps working: leaving module 2's map view for the results table, or picking another layer on it, must not take the page down. If module 2 errors out computing deforestation, you probably skipped `git lfs pull` (4.1).

### 4.5 Suggested reading order

Before changing code, read the root `CLAUDE.md`: it lists the conventions, the invariants and the commands CI runs, with links back to these docs.

The backend is smaller and concentrates the product logic; start there:

1. `apps/api/app/main.py` → the endpoint map.
2. `apps/api/app/maps/index.json` → what a "map"/raster is (pixel_size, baseline, countries).
3. `layer_analysis/router.py` → `helpers.py` → `helpers/GeometryCalculator.py` → **the core** (§2.3).
4. `tools/update-gfw-tmf/run.py` → where the rasters come from and why `==1` means deforestation.
5. Frontend: `context/DataContext.tsx` (the state) → `api/*.ts` (the contracts) → one full screen end to end.

### 4.6 A good first exercise (low risk, high learning)

Trace a single farm through the whole pipeline to internalize §2.2 and §2.3 — this touches the core paths without changing any behavior, so it's safe on day one:

1. Run the backend test suite (`pnpm test` in `apps/api`) and read `tests/modules/layer_analysis/test_helpers.py` to see the deforestation math exercised in isolation.
2. From Swagger (`http://localhost:8000/docs`), call `POST /farms/parse` with one farm, then feed its output into `POST /polygons_validation/validate` and `POST /layer_analysis/analyze`, watching how the payload changes at each step.
3. In the frontend, add a log (or breakpoint) in `context/DataContext.tsx` and follow the same farm across the three screens.

### 4.7 Gotchas (things that surprise newcomers)

- 🔴 **Deforestation analysis won't work without the Git LFS rasters.** git-lfs is not installed by default: install it, then run `git lfs install` and `git lfs pull` (see 4.0–4.1).
- 🔄 **Refreshing the browser wipes the whole flow** (state lives only in frontend memory).
- 🧩 **Each frontend module can point to a different backend** (one env var per endpoint, all falling back to `NEXT_PUBLIC_API_URL`).
- 🤫 A `value: null` (or area `-1`) in the results means "could not be computed", not a crash.

### 4.8 Trying the layers admin locally

The admin is off unless the API has a session secret and a layers root in the per-country layout. To try it without touching the Git-tracked layers (flat layout), migrate a copy:

```bash
cd apps/api
uv run python -m app.modules.layers.migrate_countries --source app/maps --target .local-maps
```

It writes the per-country layout to `.local-maps` (ignored by Git), with each country's `categories.json` holding the Deforestación category, and prints one passkey per country (EC, CO, CR): keep them in a password manager, not in a file. Put these settings in `apps/api/.env` and restart the backend:

```bash
MAPS_ROOT=.local-maps
ADMIN_SESSION_SECRET=<a random string of 32+ characters>
ADMIN_ALLOWED_ORIGIN=http://localhost:3000
```

Then open **`http://localhost:3000/admin`** and log in with one country's passkey: the admin only shows that country's layers. Passkeys never go in `.env`; only their hashes, in `.local-maps/countries.json`. To add a country or get a new passkey, use `uv run python -m app.modules.admin.countries add|rotate <CC>` (see `docs/maps.md`). The frontend needs no extra setting (it calls `${NEXT_PUBLIC_API_URL}/admin`). `http://localhost:8000/health` shows which `mapsRoot` the API is using.

To test raster uploads, use a binary GeoTIFF (see the requirements in `docs/maps.md`). To start over, delete `.local-maps` and migrate again.

The **Usage** page (`/admin/usage`, in the admin sidebar) shows every country's figures, whatever the country you logged in with. It needs `USAGE_DIR=.usage` (ignored by Git) in `apps/api/.env`; without it the page says metrics aren't configured. Uploading farms or running an analysis in the public app records events there (see `docs/maps.md` for the folder's layout).
