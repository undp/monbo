# Monbo API

This is the backend API for Monbo, built with FastAPI, a modern web framework for building APIs with Python.

## Project Structure

```
monbo-api/
├── app/
│  ├── maps/
│  │   ├── index.json  # Map index with metadata
│  │   ├── layers/rasters/  # Map assets (.tiff)
│  │   ├── metadata/
│  │   │   ├── attributes/  # Map attributes
│  │   │   │   ├── en/  # English attributes
│  │   │   │   └── es/  # Spanish attributes
│  │   │   └── considerations/  # Map considerations
│  │   │       ├── en/  # English considerations
│  │   │       └── es/  # Spanish considerations
│  ├── models/  # Request and response models
│  ├── modules/  # Route handlers for the application, organized by feature
│  ├── templates/  # HTML templates for responses
│  ├── utils/  # Utility functions
│  ├── main.py  # FastAPI application entry point
├── tests/  # Additional test cases
├── pyproject.toml  # Project metadata + Python dependencies (managed by uv)
├── uv.lock  # Fully resolved, pinned dependency lockfile
├── .python-version  # Pinned Python version (3.11)
├── package.json  # Node.js package file to manage commands
├── Dockerfile.dev / Dockerfile.prod  # Docker build configurations
└── .env.template  # Template for environment variables
```

## Tooling

Python dependencies are managed with [uv](https://docs.astral.sh/uv/). `pyproject.toml`
declares production dependencies plus a `dev` dependency-group (pytest, pytest-cov,
ruff, black, mypy, memory-profiler), and `uv.lock` is the single source of truth for
resolved versions.
Install uv with `curl -LsSf https://astral.sh/uv/install.sh | sh` (see the
[uv docs](https://docs.astral.sh/uv/getting-started/installation/) for other methods).

## Core functionalities

These are the core modules of the API:

### 1. Polygons Validation

This module is responsible for validating the polygons and points of interest. The current implemented validations are:

- Polygons overlap
  ![](/docs/polygon_overlap_example.png)

- Invalid geometries:
  - Polygons self-intersections
    ![](/docs/polygon_self_intersection_example.png)
  - Polygon with few points
    ![](/docs/polygon_few_points_example.png)
- Empty polygons

The libraries used for this module are:

- [Shapely](https://shapely.readthedocs.io/en/stable/)

### 2. Deforestation Analysis

This module is responsible for analyzing the deforestation of the polygons and points of interest.

This module uses the raster layers located in the `monbo-api/app/maps` directory.

The libraries used for this module are:

- [Shapely](https://shapely.readthedocs.io/en/stable/): for geometric operations
- [Rasterio](https://rasterio.readthedocs.io/en/stable/): for raster data processing and manipulation
- [Geopandas](https://geopandas.org/en/stable/): for geospatial data handling
- [Mercantile](https://mercantile.readthedocs.io/en/stable/index.html): for tile calculations
- [Numpy](https://numpy.org/): for numerical operations
- [Pillow](https://pillow.readthedocs.io/en/stable/): for image processing
- [asyncio](https://docs.python.org/3/library/asyncio.html): for asynchronous operations and context management

The deforestation percentage is calculated using the following formula:

$$
\text{deforestationPercentage} = \frac{\text{deforestedPixelsInsidePolygon} * \text{pixelArea}}{\text{totalPolygonArea}}
$$

with the following considerations:

- The pixels inside the polygon are found using [rasterio's mask](https://rasterio.readthedocs.io/en/latest/api/rasterio.mask.html) method.
- The pixel area depends on the raster layer resolution. For example, if the resolution is 30x30 meters, the pixel area will be 900 m².
- The polygon total area is calculated based on the [area calculation methodology](docs/polygon_area_calculation.md).

So, if the deforested pixels inside the polygon are 100, the pixel area is 900 square meters and the total polygon area is 50 hectares, the deforestation percentage would be 18%.

### 3. Report Generation

This module is responsible for providing the necessary data and assets to generate, at Frontend, the PDF report for the deforestation analysis.

Also, view the report generation docs at Frontend documentation [here](monbo-front/README.md).

The file generated is a PNG image combining a satelital background with the polygon drawn on top of it and the deforestation areas surrounding the polygon.

![](/docs/deforestation_image_example.png)

The libraries used for this module are:

- **PIL (Pillow)**: primary image processing library for creating, manipulating, and combining images
- **numpy**: for numerical operations and array manipulation of raster data
- **shapely**: for geometric operations, polygon/point handling, and spatial calculations
- **pyproj**: for coordinate system transformations (WGS84 to Web Mercator)
- **rasterio**: for reading and manipulating raster data (TIF files)
- **geopandas**: for geospatial data handling
- **httpx**: for making HTTP requests to Google Maps API
- **urllib.parse**: for URL parsing and manipulation
- **hashlib**: for generating cryptographic hashes
- **hmac**: for HMAC signature generation
- **base64e**: for encoding/decoding data
- **asyncio**: for asynchronous operations and context management
- **io**: for BytesIO operations
- **math**: for mathematical calculations
- **typing**: for type hints
- **types**: for type checking in context managers

## Running the Application

There are many ways to run the API application. In any case the API will be available at `http://localhost:8000`.

First, you need to create a `.env` file at the `monbo-api` directory containing the environment variables (please use the `.env.template` file as a template). If you are using the Docker approach, DO NOT use string quotes for the values.

Then, execute the following command:

### 1. Using Docker for development mode

You can run the API in a Docker container in development mode. The source code (including the `.env` file) will be mounted as a docker volume. This approach supports hot-reloading.

```sh
cd monbo-api
docker build -f Dockerfile.dev -t monbo-api-dev .
docker run -d -p 8000:8000 --name monbo-api-dev-container -v $(pwd):/app monbo-api-dev
```

### 2. Using Docker for production mode

You can build and run the API image in a Docker container. Note that this approach does not support hot-reloading.

```sh
cd monbo-api
docker build -f Dockerfile.prod -t monbo-api-prod .
docker run -d -p 8000:8000 --name monbo-api-prod-container --env-file <env-file-relative-path> monbo-api-prod
```

### 3. Run FastAPI in development mode

We use [uv](https://docs.astral.sh/uv/) to manage the Python environment and `pnpm` to
standardize command execution using the `package.json` file's scripts (each script
delegates to uv), similar to the frontend. This will start the FastAPI development
server with hot-reloading.

uv creates and manages the virtual environment automatically, pinned to Python 3.11 via
`.python-version` — no manual `venv` step is required. Install the dependencies and run
the development server:

```sh
pnpm install   # delegates to `uv sync`
pnpm dev       # delegates to `uv run fastapi dev ./app/main.py`
```

Or use uv directly:

```sh
uv sync
uv run fastapi dev ./app/main.py
```

### 4. Run FastAPI in production mode

We use pnpm to standardize command execution using the `package.json` file's scripts
(each script delegates to uv), similar to the frontend. This will start the FastAPI
production server.

uv manages the virtual environment automatically (Python 3.11), so no manual `venv` step
is required. Install the dependencies and run the production server:

```sh
pnpm install   # delegates to `uv sync`
pnpm start     # delegates to `uv run uvicorn app.main:app ...`
```

Or use uv directly:

```sh
uv sync
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 12
```

## Dependencies

The API requires the following dependencies:

| Package           | Version | Description                                                                 |
| ----------------- | ------- | --------------------------------------------------------------------------- |
| fastapi[standard] | 0.115.6 | FastAPI framework with the `standard` extra (uvicorn, Jinja2, etc.)         |
| shapely           | 2.0.6   | Geometric objects and operations                                            |
| pyproj            | 3.7.0   | Cartographic projections and coordinate transformations                     |
| uvicorn           | 0.34.0  | ASGI server for running FastAPI applications                                |
| httpx             | 0.28.1  | HTTP client for Python                                                      |
| geopandas         | 1.0.1   | Geospatial data handling in Python                                          |
| rasterio          | 1.4.3   | Geospatial raster data access                                               |
| colorlog          | 6.9.0   | Colored logging for Python                                                  |
| mercantile        | 1.2.1   | Tile-based mapping utilities                                                |
| pillow            | 11.1.0  | Image processing capabilities                                               |
| python-dotenv     | 1.0.1   | Read key-value pairs from a .env file and set them as environment variables |
| pycountry         | 24.6.1  | ISO country/subdivision databases                                           |

The full, resolved and pinned dependency set (including transitive dependencies and the
`dev` group: pytest 8.3.4, pytest-cov 6.0.0, ruff, black, mypy, memory-profiler) lives
in `uv.lock`.
Run `uv sync` (or `pnpm install`) to install everything from the lockfile, or
`uv sync --no-dev` to install production dependencies only.

## Available Scripts

The `package.json` file is used to standardize the execution of commands across environments, making it easier to work with both frontend and backend using pnpm.

- **pnpm install** - Install Python dependencies (`uv sync`)
- **pnpm start** - Run FastAPI server in production mode (`uv run uvicorn ...`)
- **pnpm dev** - Run FastAPI development server with hot reload (`uv run fastapi dev ...`)
- **pnpm test** - Run unit tests with pytest (`uv run pytest`)
- **pnpm lint** - Run ruff + black + mypy checks, matching CI (`uv run ruff check . && uv run black --check . && uv run mypy app`)
- **pnpm build** - Build the production Docker image
- **pnpm profile:cprofile** - Run the server under cProfile (`uv run python -m cProfile ...`)
- **pnpm profile:memory** - Run the server under memory-profiler's `mprof` (`uv run mprof run ...`)

All scripts delegate to uv, so you can also invoke the underlying commands directly, e.g.
`uv run pytest` or `uv run ruff check .`.

## Environment Variables

The application requires the following environment variables to be set:

- `GCP_MAPS_PLATFORM_API_KEY`: Google Maps Platform API key for accessing Google Maps services
- `GCP_MAPS_PLATFORM_SIGNATURE_SECRET`: Google Maps Platform signature secret for accessing Google Maps services
- `OVERLAP_THRESHOLD_PERCENTAGE`: Defines the minimum percentage overlap required when comparing polygons (tolerance ceiling). Used to determine when two polygons should be considered being overlapping. Type: Float. Range: 0-100. Default: 0

For local development, you can set the environment variables in a `.env` file. The `.env.template` file is provided as a reference.

## Development Guidelines

### Code Style and Conventions

- We follow **PEP 8** for Python code formatting.
- API endpoints follow **RESTful** conventions.
- Dependency injection is used for shared services.
- Logging is configured using the **logging** module.

### Testing

Run tests with:

**Command:**

```sh
pnpm test
```

or directly with:

**Command:**

```sh
uv run pytest
```

## Continuous Integration

Pull requests marked "ready for review" are validated by the `API CI` GitHub Actions
workflow (`.github/workflows/api.yml`), which runs `uv sync --frozen`, `uv run pytest`,
and the `ruff`/`black`/`mypy` checks. Draft PRs are skipped.

These checks are **blocking**: every step runs without `continue-on-error`, so the job
fails (and the pull request is prevented from merging, once branch protection requires
the check) if the suite, lint, formatting, or type checks fail. The pytest run includes
the deterministic numeric baseline gate (`tests/test_numeric_baseline.py`), which
re-runs the deforestation fixture under the committed lock (numpy 2) and compares it
against the version-controlled numpy 1 reference within the tolerances defined by the
`python-dependency-toolchain` spec.

## API Documentation

FastAPI provides interactive API documentation:

- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Deployment

TODO
