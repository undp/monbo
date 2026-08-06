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

![](/docs/frontend.png)

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

Python dependencies are managed with [uv](https://docs.astral.sh/uv/) (`pyproject.toml` + `uv.lock`). The API is containerized using Docker for consistent deployment across environments. Also, it follows RESTful principles and uses JSON for data exchange.

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

You can run each service separately (navigate to each service's directory and follow the instructions in their respective README files), or use the root orchestrator.

The backend is intended to be available at `http://localhost:8000` while the frontend is intended to be available at `http://localhost:3000`.

### Prerequisites

- [pnpm](https://pnpm.io/) for the frontend (the exact version is pinned via the `packageManager` field).
- [uv](https://docs.astral.sh/uv/) for the Python API and scripts — install with `curl -LsSf https://astral.sh/uv/install.sh | sh`.

### Root orchestrator

A root `package.json` provides orchestrator scripts that delegate to each package (option A: no pnpm workspace; each package keeps its own lockfile, and a minimal root `pnpm-lock.yaml` pins the `concurrently` devDependency). Frontend commands delegate via `pnpm --dir monbo-front` and Python commands via `uv run --directory monbo-api`:

```sh
pnpm dev     # runs the frontend and API dev servers in parallel (via `pnpm exec concurrently`)
pnpm test    # runs the API test suite (uv run pytest)
pnpm lint    # lints the frontend and the API (ruff + black + mypy), matching CI
pnpm build   # builds the frontend production bundle
```

> **Node ≥22 required for the root orchestrator.** The pinned `concurrently` devDependency declares `engines.node >=22`, so the root scripts above expect Node 22+. The individual packages still target Node 20 for now (the frontend's `engines` floor is raised to Node 22 later, with the `node:22-alpine` Docker bump), so you can run each service directly on Node 20 from its own directory. On Node 20 the orchestrator only prints a pnpm engine warning (`engine-strict` is off) rather than failing, but use Node 22 to run it cleanly.

## Continuous Integration

- **CI:** GitHub Actions workflows (`.github/workflows/frontend.yml`, `.github/workflows/api.yml`) validate every pull request marked "ready for review" (drafts are skipped). The frontend job runs `pnpm install --frozen-lockfile` + `tsc --noEmit` + lint + build (caching the pnpm store and `.next/cache`); the API job runs `uv sync --frozen` + `uv run pytest` + ruff/black/mypy.
- **Dependency updates:** an automated dependency bot (Dependabot) is planned as the final step of the toolchain upgrade; it is not wired up yet.
