# Monbo

## Table of Contents

- [About the Tool](#about-the-tool)

- [Project Structure](#project-structure)

  - [Frontend](#frontend)
  - [API](#api)
  - [Docs](#docs)
  - [Scripts](#scripts)

- [How to run](#how-to-run)

- [Suggested Infrastructure](#suggested-infrastructure)

## About the Tool

![](/docs/frontend-en.png)

Monbo is ...

### Module: Polygon and Point Validation

TBD

### Module: Deforestation Analysis

TBD

### Module: Batch Creation

TBD

### Module: Due Diligence Generation

TBD

## Project Structure

Project contains 4 subfolders, each has a separate set of instructions how to use.

1. Frontend: `monbo-front`

2. API: `monbo-api`

3. Docs: `docs`

4. Scripts: `scripts`

### Frontend

The frontend is built with [React](https://react.dev/) and [Next.js 15](https://nextjs.org/), providing a modern, server-side rendered (SSR) web application. Next.js offers enhanced performance through automatic code splitting, optimized image handling, and built-in routing capabilities.

The application follows a component-based architecture and implements the App Router pattern introduced in Next.js 13+. Static assets are automatically optimized, and the development environment supports hot reloading for a seamless development experience.

Check the frontend [README](monbo-front/README.md) for more detailed instructions on how to use.

### API

This project implements a RESTful API using [FastAPI](https://fastapi.tiangolo.com/), a modern Python web framework known for its high performance and automatic API documentation.

The API is containerized using Docker for consistent deployment across environments. Also, it follows RESTful principles and uses JSON for data exchange.

Check the API [README](monbo-api/README.md) for more detailed instructions on how to use.

### Docs (!!!!)

This folder contains comprehensive documentation covering various aspects of the project beyond the main README. This includes detailed technical specifications, architectural decisions (ADRs), setup guides, and maintenance procedures.

The documentation is organized into distinct categories: `/docs/api` for detailed API endpoint documentation and schemas, `/docs/frontend` for component architecture and state management details, `/docs/deployment` for environment-specific deployment guides, and `/docs/development` for development workflows and coding standards.

Each document follows Markdown format for consistency and readability.

### Scripts

The `/scripts` directory houses standalone utility scripts and mini-projects for data processing and automation.

A notable component is the `update-gfw-tmf` tool, which provides a robust Python implementation for downloading and processing deforestation data from Global Forest Watch (GFW) and Tropical Moist Forest (TMF) datasets using Google Earth Engine. This script features an object-oriented design with abstract base classes, multi-threaded downloading capabilities, and automatic cleanup mechanisms. It handles large-scale geospatial data processing, including tiled downloads, compression, and error handling. The tool is fully documented with a comprehensive README that covers installation, configuration, usage patterns, and troubleshooting guidelines.

Other scripts in this directory follow similar patterns of being self-contained, well-documented tools that serve specific data processing or automation needs within the project.

## How to run

The project can be run in two different ways:

1. Using Docker Compose with the development configuration (**docker-compose.dev.yml**), which runs both the frontend and backend in the same container but on different ports (frontend on 3000, backend on 8000) with hot-reload enabled for both services. This is achieved by mounting the source code directories as volumes and running the development servers.

2. Alternatively, you can run each service independently by navigating to their respective directories and using the development commands
   - for the frontend, you can use `pnpm dev` in the **monbo-front** directory (as specified in **package.json**)
   - for the API, we added a package.json file in the **monbo-api** directory with the same `pnpm dev` development command, to make it easier to run the API independently.

Both approaches provide hot-reload functionality, with the Docker approach offering a more containerized and consistent development environment.

## Suggested Infrastructure

TBD
