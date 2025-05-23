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
├── requirements.txt  # Python dependencies
├── package.json  # Node.js package file to manage commands
├── Dockerfile  # Docker build configuration
└── .env.template  # Template for environment variables
```

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

We use `pnpm` to standardize command execution using the `package.json` file's scripts, similar to the frontend. This will start the FastAPI development server with hot-reloading.

First, we recommend to create a virtual environment with Python 3.11:

```sh
python3.11 -m venv .venv
source .venv/bin/activate
```

Then, install the dependencies and run the development server:

```sh
pnpm install
pnpm dev
```

### 4. Run FastAPI in production mode

We use pnpm to standardize command execution using the `package.json` file's scripts, similar to the frontend. This will start the FastAPI production server.

First, we recommend to create a virtual environment with Python 3.11:

```sh
python3.11 -m venv .venv
source .venv/bin/activate
```

Then, install the dependencies and run the production server:

```sh
pnpm install
pnpm start
```

## Dependencies

The API requires the following dependencies:

| Package           | Version | Description                                                                 |
| ----------------- | ------- | --------------------------------------------------------------------------- |
| fastapi           | 0.115.6 | FastAPI framework for building APIs with Python                             |
| fastapi[standard] | 0.115.6 | Standard FastAPI dependencies                                               |
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
| pytest            | 8.3.4   | Testing framework for Python                                                |
| pytest_cov        | 6.0.0   | Coverage plugin for pytest                                                  |

You can install dependencies manually using the install script declared in the `package.json` file.

## Available Scripts

The `package.json` file is used to standardize the execution of commands across environments, making it easier to work with both frontend and backend using pnpm.

- **pnpm install** - Install Python dependencies
- **pnpm start** - Run FastAPI server in production mode
- **pnpm dev** - Run FastAPI development server with hot reload
- **pnpm test** - Run unit tests with pytest
- **pnpm build** - Build the Docker image

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
pytest
```

## API Documentation

FastAPI provides interactive API documentation:

- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Deployment

TODO
