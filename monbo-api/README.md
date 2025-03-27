# Monbo API 

This is the backend API for Monbo, built with FastAPI, a modern web framework for building APIs with Python.

## Project Structure 

```
monbo-api/
├── app/
│  ├── api/  # API route handlers
│  ├── core/  # Core application configurations and utilities
│  ├── models/  # Database models and schemas
│  ├── services/  # Business logic and service layer
│  ├── tests/  # Unit and integration tests
│  ├── main.py  # FastAPI application entry point
│  └── dependencies.py  # Dependency injection and shared resources
├── tests/  # Additional test cases
├── requirements.txt  # Python dependencies
├── package.json  # Node.js package file to manage commands
├── Dockerfile  # Docker build configuration
├── docker-compose.dev.yml  # Docker Compose file for development
└── .env.template  # Template for environment variables
```

## Running the Application

There are three ways to run the backend application:  

### 1. Using Docker Compose (API + Frontend)

This method runs both the backend and frontend services in separate containers.

**Command:**

```sh
docker-compose -f docker-compose.dev.yml up
```  

-   The backend will be available at http://localhost:8000
-   The frontend will be available at http://localhost:3000 

### 2. Using Development Mode (API Only)

We use pnpm to standardize command execution, similar to the frontend.

**Commands:**

``` sh
pnpm install
pnpm dev
```  

This will start the FastAPI development server with hot-reloading. The API will be available at `http://localhost:8000`  

### 3. Using Docker (API Only)

You can build and run the backend in a Docker container.  

**Commands:**

```sh
pnpm build
docker run -p 8000:8000 fastapi
```

The API will be available at `http://localhost:8000 `. However, note that this approach does not support hot-reloading. 

## Dependencies

The API requires the following dependencies:

-   doit==0.36.0
-   fastapi==0.115.6
-   fastapi[standard]==0.115.6
-   shapely==2.0.6
-   pytest==8.3.4
-   pytest_cov==6.0.0
-   pyproj==3.7.0
-   uvicorn==0.34.0
-   geopandas==1.0.1
-   rasterio==1.4.3
-   mercantile==1.2.1
-   pillow==11.1.0

You can install dependencies manually using:  

**Command:**

``` sh
pip install -r requirements.txt
``` 

## Available Scripts

The `package.json` file is used to standardize the execution of commands across environments, making it easier to work with both frontend and backend using pnpm.

-   **pnpm install** - Install Python dependencies
-   **pnpm start** - Run FastAPI server in production mode
-   **pnpm dev** - Run FastAPI development server with hot reload
-   **pnpm test** - Run unit tests with pytest
-   **pnpm build** - Build the Docker image
  
## Environment Variables

No enviromental variables are needes

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
