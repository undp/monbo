# Monbo

> **Branches.** `dev` is the default and integration branch: it holds work that has not been released yet, and every pull request targets it. `main` holds the latest release and only changes when `dev` is released into it, or through a hotfix. See [`docs/branch_protection.md`](docs/branch_protection.md#release-and-hotfix-flow).

## Table of Contents

- [About the Tool](#about-the-tool)

- [Project Structure](#project-structure)

  - [Frontend](#frontend)
  - [API](#api)
  - [Docs](#docs)
  - [Tools](#tools)

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

Deployable applications live under `apps/`, offline tools under `tools/`, and the Azure infrastructure (Terraform) under `infra/`. Each has its own instructions.

1. Frontend: `apps/web` (package `monbo-front`)

2. API: `apps/api` (package `monbo-api`)

3. Docs: `docs`

4. Tools: `tools` (the GFW/TMF raster update script, and `layers-ops` for the Azure layer share)

5. Infrastructure: `infra` (Terraform stacks and `deploy.sh`; how it works in [`infra/README.md`](infra/README.md), how to deploy in [`docs/suggested_deployment.md`](docs/suggested_deployment.md))

### Frontend

The frontend is built with [React](https://react.dev/) and [Next.js 15](https://nextjs.org/), providing a modern, server-side rendered (SSR) web application. Next.js offers enhanced performance through automatic code splitting, optimized image handling, and built-in routing capabilities.

The application follows a component-based architecture and implements the App Router pattern introduced in Next.js 13+. Static assets are automatically optimized, and the development environment supports hot reloading for a seamless development experience.

Check the frontend [README](apps/web/README.md) for more detailed instructions on how to use.

### API

This project implements a RESTful API using [FastAPI](https://fastapi.tiangolo.com/), a modern Python web framework known for its high performance and automatic API documentation.

Python dependencies are managed with [uv](https://docs.astral.sh/uv/) (`pyproject.toml` + `uv.lock`). The API is containerized using Docker for consistent deployment across environments. Also, it follows RESTful principles and uses JSON for data exchange.

Check the API [README](apps/api/README.md) for more detailed instructions on how to use.

### Docs

This folder contains comprehensive documentation covering various aspects of the project beyond the main README. This includes detailed technical specifications, architectural decisions (ADRs), setup guides, and maintenance procedures.

The documentation is organized into distinct categories: `/docs/api` for detailed API endpoint documentation and schemas, `/docs/frontend` for component architecture and state management details, `/docs/deployment` for environment-specific deployment guides, and `/docs/development` for development workflows and coding standards.

Each document follows Markdown format for consistency and readability.

Start with [`docs/architecture.md`](docs/architecture.md): the Azure infrastructure and how its resources interact, how the API reads the layers' rasters, and how each country administers its own layers.

### Tools

The `/tools` directory houses standalone utility scripts and mini-projects for data processing and automation. They are not deployed.

A notable component is the `update-gfw-tmf` tool, which provides a robust Python implementation for downloading and processing deforestation data from Global Forest Watch (GFW) and Tropical Moist Forest (TMF) datasets using Google Earth Engine. This script features an object-oriented design with abstract base classes, multi-threaded downloading capabilities, and automatic cleanup mechanisms. It handles large-scale geospatial data processing, including tiled downloads, compression, and error handling. The tool is fully documented with a comprehensive README that covers installation, configuration, usage patterns, and troubleshooting guidelines.

Other tools in this directory follow similar patterns of being self-contained, well-documented tools that serve specific data processing or automation needs within the project.

## Running the project

You can run each service separately (navigate to each service's directory and follow the instructions in their respective README files), or use the root orchestrator.

The backend is intended to be available at `http://localhost:8000` while the frontend is intended to be available at `http://localhost:3000`.

### Prerequisites

- [pnpm](https://pnpm.io/) for the frontend (the exact version is pinned via the `packageManager` field).
- [uv](https://docs.astral.sh/uv/) for the Python API and tools — install with `curl -LsSf https://astral.sh/uv/install.sh | sh`.

### Root orchestrator

A root `package.json` provides orchestrator scripts that delegate to each package (option A: no pnpm workspace; each package keeps its own lockfile, and a minimal root `pnpm-lock.yaml` pins the `concurrently` devDependency). Frontend commands delegate via `pnpm --dir apps/web` and Python commands via `uv run --directory apps/api`:

```sh
pnpm dev     # runs the frontend and API dev servers in parallel (via `pnpm exec concurrently`)
pnpm test    # runs the API test suite (uv run pytest)
pnpm lint    # lints the frontend and the API (ruff + black + mypy), matching CI
pnpm build   # builds the frontend production bundle
```

> **Node 24 required.** `monbo-front` declares `engines.node >=24`, both frontend Docker images are `node:24-alpine`, and CI pins `actions/setup-node` to 24 — so 24 is the version the app is built and shipped on. The root orchestrator needs at least 22 (its pinned `concurrently` declares `engines.node >=22`), which 24 satisfies. Because pnpm's `engine-strict` is off, running on an older Node prints an engine warning instead of failing; use 24 so the warning stays meaningful.

## Continuous Integration

- **CI:** one GitHub Actions workflow (`.github/workflows/ci.yml`) validates pull requests into `dev` and `main` once they are marked "ready for review" (drafts are skipped). It runs only the jobs for the apps a PR changes: the frontend job (`apps/web`) runs `pnpm install --frozen-lockfile` + `tsc --noEmit` + lint + build (caching the pnpm store and `.next/cache`); the API job (`apps/api`) runs `uv sync --frozen` + `uv run pytest` + ruff/black/mypy. A job a PR doesn't affect is skipped, which counts as passed ([`docs/branch_protection.md`](docs/branch_protection.md#which-checks-run)).
- **Branch protection:** `main` and `dev` each require a pull request and both CI jobs to pass before merging; neither accepts direct pushes. The policy, the exact required check names, the release and hotfix flow, and how to apply and verify it are documented in [`docs/branch_protection.md`](docs/branch_protection.md).
- **Continuous deployment:** merging into `dev` a change to the apps (or their deploy) deploys the `dev` environment in Azure (`.github/workflows/deploy.yml` → `infra/deploy.sh dev`), with automatic rollback if the new revisions don't become healthy. See [`docs/suggested_deployment.md`](docs/suggested_deployment.md#continuous-deployment).
- **Dependency updates:** Dependabot (`.github/dependabot.yml`) opens update pull requests against `dev` on a weekly schedule.

### Dependency update policy

Dependabot covers seven manifest locations, one entry per ecosystem and directory:

| Ecosystem | Directory | Day |
| --- | --- | --- |
| `npm` | `/` (root orchestrator) | Monday |
| `npm` | `/apps/web` | Monday |
| `uv` | `/apps/api` | Tuesday |
| `uv` | `/tools/update-gfw-tmf` | Tuesday |
| `docker` | `/apps/api` | Wednesday |
| `docker` | `/apps/web` | Wednesday |
| `github-actions` | `/` | Thursday |

The policy in one paragraph: **minor and patch updates are grouped** per ecosystem so routine churn arrives as a single reviewable pull request, **majors are deliberately left ungrouped** so each gets its own PR and can be read against its changelog in isolation, `open-pull-requests-limit` bounds the queue, and **nothing is automerged** — every update passes CI and a human before it lands. Days are staggered so one ecosystem's PRs don't all arrive at once.

- **Every PR opens against `dev`,** version and security updates alike, because `dev` is the default branch. No entry sets `target-branch`: doing so would make an entry's options apply only to version updates, and security PRs would lose their labels.
- **Security updates are on.** They reach production with the next release. A fix that can't wait goes through the hotfix flow in [`docs/branch_protection.md`](docs/branch_protection.md#release-and-hotfix-flow).
- **npm and uv releases wait out a cooldown:** 3 days, or 7 for a major, so a release that gets yanked or flagged shortly after publishing is never proposed. The cooldown does not apply to security updates.

#### Active deferrals

Upgrades that a design decision deferred are `ignore` rules in `dependabot.yml`, each commented with its entry condition. Review this list at each release. Lift a deferral by deleting its rule once the condition is met. Note that `ignore` rules also silence security updates: an advisory whose only fix is an ignored version raises an alert in the Security tab but no PR.

| Dependency | Ignored | Entry condition |
| --- | --- | --- |
| `@mui/*` | majors (MUI 9) | A visual-regression harness exists |
| `@types/node` | majors | The runtime moves past Node 24. Lift with the Docker `node` rule |
| `typescript` | majors (TS 7) | typescript-eslint admits 7.x and `eslint-config-next` adopts it |
| `eslint` | majors (eslint 10) | `eslint-plugin-react` and `eslint-plugin-jsx-a11y` support it and `eslint-config-next` picks them up |
| Docker `node` (`apps/web`) | majors (Node 26) | One release cycle of soak after Node 26 becomes LTS on 2026-10-28 |
| Docker `python` (`apps/api`) | `>=3.14` | A decision to move to Python 3.14; the wheels already exist |
| `gdal` (`tools/update-gfw-tmf`) | all updates | The system GDAL strategy is decided (task 5.4 of the 2026 dependency upgrade) |

The sources are `openspec/changes/archive/2026-09-24-dependency-upgrade-2026/design.md` (D5, D10, R11, R16, "Deferred / Out-of-scope") and the OpenSpec change `dev-default-branch-and-dependabot`.

Two things worth knowing about the coverage:

- **Non-standard Dockerfile names are covered.** These directories hold `Dockerfile.dev` and `Dockerfile.prod` rather than a plain `Dockerfile`. Dependabot's Docker file fetcher selects on `/dockerfile|containerfile/i` as a substring of the filename, so both match.
- **The uv binary image is *not* covered.** `apps/api/Dockerfile.dev` and `Dockerfile.prod` pull the uv binary with `COPY --from=ghcr.io/astral-sh/uv:<version>`, and Dependabot's Docker parser only reads lines beginning with `FROM`. That version is a manual bump, and it lives in **three** places that must stay in sync:

  1. `apps/api/Dockerfile.dev`
  2. `apps/api/Dockerfile.prod`
  3. `.github/workflows/ci.yml` (the `astral-sh/setup-uv` `version:` input, in the `api` job)

Workflow actions are pinned to full commit SHAs with a `# vX.Y.Z` comment. Dependabot understands that form — it bumps the SHA and rewrites the comment — so SHA pinning and automated updates are not in tension.

**Verified on real runs (2026-09-24 → 2026-10-02).** Everything above was first checked against dependabot-core's source. The bot's real runs have since confirmed it:

- all seven entries opened PRs;
- the `uv` entries move `pyproject.toml` and `uv.lock` together (#37, #48), and also fix transitive dependencies in the lock alone (#45, #46);
- the Docker entries detect both `Dockerfile.dev` and `Dockerfile.prod` (#24 and #40 touched both);
- the SHA-pinned Actions are bumped with their comment rewritten (#26, #28, #29);
- once `dev` became the default branch, Dependabot moved its open PRs to `dev`, closed the ones the new `ignore` rules cover, and opened security PRs against `dev` with their labels (#44–#46).
