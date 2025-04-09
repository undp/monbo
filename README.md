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

Monbo is an application developed to facilitate deforestation analysis and produce due diligence reports for organizations and coffee producers who need to comply with regulations such as the European Union Deforestation Regulation (EUDR). Monbo streamlines the entire process of recieving geospatial information, validating farm boundaries, monitoring deforestation risk, and generating evidence-based compliance documents. It is aimed at producers, cooperatives, exporters, and any other stakeholders needing transparent and reliable analysis for sustainable supply chains.

### Module 1: Polygon and Point Validation

This module ensures the accuracy of geolocated farm plots and points of interest. Users can upload/import shape data (polygons or single coordinates) representing production areas. The module verifies geometry consistency, checks for duplicate or overlapping areas, and flags potential issues (e.g., incorrectly formatted coordinates). By guaranteeing reliable and validated geospatial data, this module establishes a solid foundation for subsequent deforestation analysis and due diligence.

### Module 2: Deforestation Analysis

Once the polygons and points have been validated, the Deforestation Analysis module compares them against satellite imagery and up-to-date forest cover datasets. It detects signs forest loss over a baseline timeframe (from December 2020 onward) and highlights areas of concern. This functionality provides a time series review to confirm whether farm boundaries encroach on recently deforested zones (compared to baseline year), helping users document and prove that their production areas remain free of deforestation. Technical teams can also upload multiple map layers—such as official maps from governmental ministries or open-source platforms like Global Forest Watch.

### Module 3: Due Diligence Report Generation

Based on the validated geospatial data and the deforestation analysis results, this module automatically consolidates the required documentation to comply with EUDR. It generates downloadable reports or GEOJSON files that include farm coordinates, timeframes of analysis, evidence of zero deforestation (compared to baseline year), and any additional legal or sustainability documentation provided by the user. This ensures that any stakeholder can produce verifiable proof of compliance for audits, buyers or governmental authorities in the context of the EUDR.

These modules work together to give users a complete view of their supply chain’s environmental impact, significantly reducing manual processes in data collection, verification, and reporting. By using Monbo, organizations can focus on producing sustainable commodities, confident that their deforestation and compliance checks are both accurate and straightforward.

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

### Docs

This folder contains comprehensive documentation covering various aspects of the project beyond the main README. This includes detailed technical specifications, architectural decisions (ADRs), setup guides, and maintenance procedures.

The documentation is organized into distinct categories: `/docs/api` for detailed API endpoint documentation and schemas, `/docs/frontend` for component architecture and state management details, `/docs/deployment` for environment-specific deployment guides, and `/docs/development` for development workflows and coding standards.

Each document follows Markdown format for consistency and readability.

### Scripts

The `/scripts` directory houses standalone utility scripts and mini-projects for data processing and automation.

A notable component is the `update-gfw-tmf` tool, which provides a robust Python implementation for downloading and processing deforestation data from Global Forest Watch (GFW) and Tropical Moist Forest (TMF) datasets using Google Earth Engine. This script features an object-oriented design with abstract base classes, multi-threaded downloading capabilities, and automatic cleanup mechanisms. It handles large-scale geospatial data processing, including tiled downloads, compression, and error handling. The tool is fully documented with a comprehensive README that covers installation, configuration, usage patterns, and troubleshooting guidelines.

Other scripts in this directory follow similar patterns of being self-contained, well-documented tools that serve specific data processing or automation needs within the project.

## Running the project

The project can be run in different ways.

The easiest way to run the project is using Docker Compose with the provided `*.yml` files, which will run both the frontend and API on its own containers. The env-based files are configurations overrides of the base configuration (`docker-compose.yml`).

In any case, the backend will be available at `http://localhost:8000` and the frontend will be available at `http://localhost:3000`.

If you want to run only one of the services but still use the Docker Compose configuration, you can remove the section for the other service at the specific `*.yml` file.

### 1. Using Docker Compose for development mode

The development configuration (`docker-compose.dev.yml`) provides hot-reload for both services by mounting the source code directories as volumes and running the development servers.

First, you need to create a file at the root of the project containing the environment variables for the frontend (you can use the `.env.example` file as a template), and then execute the following command:

```sh
docker compose --env-file <env-file-relative-path> -f docker-compose.yml -f docker-compose.dev.yml up
```

### 2. Using Docker Compose for production mode

The production configuration (`docker-compose.prod.yml`) does not provide hot-reload, but is optimized for production environments. This is useful for testing the project in a production environment before deploying it.

First, you need to create a file at the root of the project containing the environment variables for the frontend (you can use the `.env.example` file as a template), and then execute the following command:

```sh
docker compose --env-file <env-file-relative-path> -f docker-compose.yml -f docker-compose.prod.yml up
```

### 3. Running each service independently

Navigate to each service's directory and follow the instructions in their respective README files.

We recommend using the Docker approach offering a more containerized and consistent development environment.
