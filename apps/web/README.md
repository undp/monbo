# Monbo Frontend

This is the frontend application for Monbo, built with [Next.js 15](https://nextjs.org/docs), a powerful React framework for production.

## Project Structure

```
apps/web/
├── public/          # Static files
├── src/
│   ├── api/        # API client and services; schema.d.ts is generated from the API
│   ├── app/        # Next.js app router pages
│   ├── components/ # Reusable React components
│   ├── config/     # Configuration files
│   ├── context/    # React context providers
│   ├── hooks/      # Custom React hooks
│   ├── interfaces/ # Aliases of the generated API types, plus frontend-only types
│   ├── locales/    # i18n translation files
│   └── utils/      # Utility functions
```

## Running the Application

There are many ways to run the frontend application. In any case the frontend will be available at `http://localhost:3000`.

> The pnpm version is pinned via the `packageManager` field in `package.json`, so tools like Corepack and `pnpm/action-setup` use a consistent version. You can also run the frontend from the repo root via the orchestrator (`pnpm dev`, `pnpm lint`, `pnpm build`) — see the root [README](../README.md).

### 1. Using Docker for development mode

You can run the frontend in a Docker container in development mode. The source code will be mounted as a docker volume. This approach supports hot-reloading.

First, you need to create a `.env` or `.env.development` file in the `apps/web` directory containing the environment variables (please use the `.env.development.example` file as a template).
Please follow the file name convention, because it is used by Nextjs to load them automatically.
Then, execute the following command:

```sh
cd apps/web
docker build -f Dockerfile.dev -t monbo-front-dev .
docker run -d -p 3000:3000 --name monbo-front-dev-container -v $(pwd):/app monbo-front-dev
```

### 2. Using Docker for production mode

You can build and run the productionimage in a Docker container. Note that this approach does not support hot-reloading.

First, you need to create a file in the `apps/web` directory containing the environment variables (please use the `.env.production.example` file as a template). In this case, the file name convention is not required. Then, execute the following command:

```sh
cd apps/web
docker build -f Dockerfile.prod -t monbo-front-prod .
docker run -d --env-file <env-file-relative-path> -p 3000:3000 --name monbo-front-prod-container monbo-front-prod
```

### 3. Run Next.js in development mode

If you don't want to use Docker, you can run the NextJS development server with hot-reloading.

First, you need to create a `.env` or `.env.development` file in the `apps/web` directory containing the environment variables (you can use the `.env.development.example` file as a template).
Please follow the file name convention, because it is used by Nextjs to load them automatically.

Install the dependencies and run the development server:

```sh
pnpm install
pnpm dev
```

### 4. Start the Next.js production server

This will start the NextJS production server.

First, you need to create a `.env` or `.env.production` file in the `apps/web` directory containing the environment variables (you can use the `.env.production.example` file as a template).
Please follow the file name convention, because it is used by Nextjs to load them automatically.

Install the dependencies and run the production server:

```sh
pnpm install
pnpm build
pnpm start
```

### 5. Run the compiled Next.js in production mode

This will build the NextJS standalone application and run the generated Node server.

First, you need to create a `.env` or `.env.production` file in the `apps/web` directory containing the environment variables (you can use the `.env.production.example` file as a template).
Please follow the file name convention, because it is used by Nextjs to load them automatically.

Install the dependencies and start the server:

```sh
pnpm install
pnpm build
pnpm start:standalone
```

## Dependencies

### Production Dependencies

| Package                      | Version  | Description                                     |
| ---------------------------- | -------- | ----------------------------------------------- |
| @emotion/cache               | ^11.14.0 | Emotion's cache for CSS-in-JS                   |
| @emotion/react               | ^11.14.0 | CSS-in-JS library for React                     |
| @emotion/styled              | ^11.14.0 | Styled components for Emotion                   |
| @fontsource/roboto           | ^5.1.0   | Self-hosted Roboto font files                   |
| @googlemaps/markerclusterer  | ^2.5.3   | Marker clustering for Google Maps               |
| @mui/icons-material          | ^6.3.0   | Material UI icons library                       |
| @mui/material                | ^6.3.0   | Material UI component library                   |
| @mui/material-nextjs         | ^6.3.0   | Material UI integration for Next.js             |
| @vis.gl/react-google-maps    | ^1.4.2   | React components for Google Maps                |
| file-saver                   | ^2.0.5   | File saving functionality for browsers          |
| fuse.js                      | ^7.0.0   | Lightweight fuzzy-search library                |
| i18next                      | ^24.2.0  | Internationalization framework                  |
| i18next-resources-to-backend | ^1.2.1   | i18next backend for resource files              |
| lodash                       | ^4.17.21 | JavaScript utility library                      |
| next                         | 15.1.2   | React framework for production                  |
| next-i18n-router             | ^5.5.1   | i18n routing for Next.js                        |
| react                        | ^19.0.0  | JavaScript library for building user interfaces |
| react-dom                    | ^19.0.0  | React package for DOM rendering                 |
| react-dropzone               | ^14.3.5  | Drag and drop file upload for React             |
| react-i18next                | ^15.4.0  | i18next integration for React                   |
| react-markdown               | ^10.0.0  | Markdown renderer for React                     |
| xlsx                         | ^0.18.5  | Excel file parser and generator                 |

### Development Dependencies

| Package            | Version  | Description                           |
| ------------------ | -------- | ------------------------------------- |
| @eslint/eslintrc   | ^3       | ESLint configuration utility          |
| @types/file-saver  | ^2.0.7   | TypeScript definitions for file-saver |
| @types/lodash      | ^4.17.13 | TypeScript definitions for lodash     |
| @types/node        | ^20      | TypeScript definitions for Node.js    |
| @types/react       | ^19      | TypeScript definitions for React      |
| @types/react-dom   | ^19      | TypeScript definitions for React DOM  |
| eslint             | ^9       | JavaScript linting utility            |
| eslint-config-next | 15.1.2   | ESLint configuration for Next.js      |
| typescript         | ^5       | JavaScript with syntax for types      |

## Internationalization (i18n)

The application supports multiple languages using i18next. Currently supported languages:

- English (en)
- Spanish (es)

### Translation Structure

```
src/locales/
├── en/
│   ├── common.json
│   ├── deforestationAnalysis.json
│   ├── home.json
│   └── polygonValidation.json
└── es/
    ├── common.json
    ├── deforestationAnalysis.json
    ├── home.json
    └── polygonValidation.json
```

Each JSON file corresponds to a specific page or feature:

- `common.json`: Shared translations used across the application
- `deforestationAnalysis.json`: Translations for the deforestation analysis module
- `home.json`: Home page translations
- `polygonValidation.json`: Translations for polygon validation module

If you want to add a new language, please follow the instructions in the [New Language Documentation](docs/new_language.md) file.

## Development Guidelines

### Code Style and Conventions

- We use ESLint and Prettier for code formatting
- Component naming follows PascalCase (e.g., `MapComponent.tsx`)
- Hooks use camelCase with 'use' prefix (e.g., `useMapData.ts`)
- CSS-in-JS follows BEM-like naming conventions

### API types

The types of every API request and response are generated from the API's OpenAPI
(`apps/api/openapi.json`) into `src/api/schema.d.ts` with `openapi-typescript`. Don't
edit that file, and don't write API shapes by hand: `src/interfaces/` re-exports the
generated types under the names the code uses (`FarmData`, `MapData`, …) and only
declares types that exist just in the frontend.

When the API changes a model, run `pnpm contracts` at the repository root (it
regenerates both files), fix what `tsc --noEmit` reports, and commit both generated
files. `pnpm generate:api-types` regenerates only the types, from the committed
`openapi.json`.

### Testing

There are no tests for this project yet.

### Continuous Integration

Pull requests into `dev` and `main` marked "ready for review" are validated by the
`Type-check, lint, build` job of the `CI` GitHub Actions workflow
(`.github/workflows/ci.yml`), which runs `pnpm install --frozen-lockfile`,
a check that `src/api/schema.d.ts` matches `apps/api/openapi.json`, `tsc --noEmit`,
`pnpm run lint`, and `pnpm run build` on Node 24, caching the pnpm store and
`.next/cache`. It runs when the PR changes `apps/web/` or the API contract
(`apps/api/openapi.json`), or the workflow itself; otherwise it is skipped, which counts
as passed. Draft PRs are skipped.

### Performance Optimization

- Image optimization using Next.js Image component
- Code splitting and lazy loading for routes
- Server-side rendering (SSR) for initial page loads
- Static site generation (SSG) for static pages

### Browser Support

- Chrome (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)
- Edge (latest 2 versions)

### Caching Strategies

There is no caching strategy implemented because the analysis are executed on-demand and the results are not stored.

### State Management

- **Server State**: React Query for API data
- **UI State**: React's useState and useReducer
- **Global State**: React Context for:
  - Theme preferences
  - User settings
  - Authentication
  - Language preferences

### Contributing

1. Create a new branch from `dev`
2. Make your changes
3. Submit a pull request against `dev`
4. Wait for review and approval

### Troubleshooting Common Issues

1. **Build failures**

   ```sh
   # Clear Next.js cache
   rm -rf .next
   pnpm build
   ```

2. **API connection issues**
   - Verify NEXT_PUBLIC_API_URL in .env
   - Check if backend is running
   - Confirm CORS settings

### Available Scripts

```sh
pnpm dev            # Run the development server
pnpm build          # Build the production application
pnpm start          # Start the production server
pnpm lint           # Run ESLint
pnpm docker:build   # Build the docker image
pnpm generate:api-types  # Regenerate src/api/schema.d.ts from apps/api/openapi.json
```

### Environment Variables

```sh
NEXT_PUBLIC_GET_MAPS_URL=                       # URL to get available maps for deforestation analysis
NEXT_PUBLIC_GET_CONFIG_URL=                     # URL of the API's product settings (GET /config); defaults to NEXT_PUBLIC_API_URL/config

NEXT_PUBLIC_POLYGON_VALIDATION_PARSER_URL=      # URL to parse excel file data into valid Farm objects for polygon validation module
NEXT_PUBLIC_POLYGON_VALIDATION_URL=             # URL to execute polygons validation and find inconsistencies
NEXT_PUBLIC_DEFORESTATION_ANALYSIS_PARSER_URL=  # URL to parse excel file data into valid Farm objects for deforestation analysis
NEXT_PUBLIC_DEFORESTATION_ANALYSIS_URL=         # URL to execute deforestation analysis
NEXT_PUBLIC_DEFORESTATION_ANALYSIS_TILES_URL=   # URL to get map tiles with deforestation data drawn on them
NEXT_PUBLIC_GCP_MAPS_PLATFORM_API_KEY=             # Google Maps API key
NEXT_PUBLIC_MAX_REQUESTS_FOR_SATELLITE_BACKGROUND_AT_DEFORESTATION_IMAGE_GENERATION= # Most farms whose report images get a satellite background (one Google Static Maps call per farm); above it they get a solid one. Empty = no limit
```

The overlap and deforestation thresholds are not frontend variables: the API owns them (`OVERLAP_THRESHOLD_PERCENTAGE`, `DEFORESTATION_THRESHOLD_PERCENTAGE`) and publishes them at `GET /config`. The app loads them once at startup (`src/config/runtime.ts`) and renders the pages only after they arrive; if they can't be loaded it shows an error with a retry button.

### PDF report

The report is rendered in the browser with `@react-pdf/renderer`, off the main thread:

- `ReportProvider` (`src/context/ReportContext.tsx`) wraps the preview page. It fetches the report images once per selection (`POST /deforestation_analysis/generate-image`, JPEG) and shares them with the preview and both downloads.
- Every PDF renders in a Web Worker (`src/workers/reportPdf.worker.tsx`), which sets up its own i18next and runtime config. The page only shows the result in an iframe.
- Once the preview is shown, the complete report (with links, which the preview hides) is pre-rendered, so "Download" saves it at once. The separated reports (a ZIP) render on click.
- The fonts (`public/fonts/roboto`: Roboto regular, medium, bold, italic and bold italic, Apache 2.0) and images are served by the app itself: rendering makes no third-party requests.

The endpoints of each module are defined as environment variables because this project is modularized and each module has its own backend service. You could use your own backend services by changing the environment variables and following the same structure for the requests and responses.

### Architecture Decisions

- Material UI for consistent design system
- Emotion for CSS-in-JS styling
- React Query for server state management
- i18next for internationalization
- Google Maps for mapping functionality

## Dependency updates

Frontend dependencies are updated by Dependabot (`npm` ecosystem on `/apps/web`,
plus a `docker` entry for the two Dockerfiles), weekly, with minor and patch updates
grouped into one pull request and each major isolated in its own. Nothing is
automerged. See the root README for the full policy.

### Outside Dependabot's reach

Two dependencies need a manual check, because Dependabot can't update them:

- **`xlsx` (SheetJS) comes from SheetJS's CDN**, not npm: SheetJS stopped publishing to
  npm at 0.18.5, which has known vulnerabilities (prototype pollution, ReDoS), and
  publishes its fixes only at `cdn.sheetjs.com`. `package.json` pins the versioned
  tarball (`https://cdn.sheetjs.com/xlsx-<version>/xlsx-<version>.tgz`).
  - **To bump it:** check the release notes at <https://docs.sheetjs.com> (or
    <https://cdn.sheetjs.com/> for the versions), run
    `pnpm add "xlsx@https://cdn.sheetjs.com/xlsx-<version>/xlsx-<version>.tgz"`, then
    upload `apps/api/tests/regression/regression_farms.xlsx` in both modules and
    download both Excel results.
  - **Its content isn't verified.** pnpm records no integrity hash for a remote
    tarball, so the lockfile pins the URL, not the bytes: we trust SheetJS's HTTPS
    host. If that ever stops being acceptable, vendor the tarball
    (`apps/web/vendor/xlsx-<version>.tgz`, declared as `file:vendor/...`, and copied
    into both Dockerfiles before `pnpm install`): pnpm then records its `sha512` and
    `--frozen-lockfile` fails if it changes.
- **`pnpm.overrides` in `package.json`:** `"exceljs>uuid": "^11.1.1"`. `exceljs` 4.4.0
  (its latest release) asks for `uuid ^8.3.0`, and the fix for GHSA-w5hq-g745-h8pq is
  in 11.1.1. `exceljs` only calls `v4()`, which `uuid` 11 keeps, and the browser loads
  `exceljs`'s prebundled build anyway. **Remove it** when `exceljs` allows
  `uuid >= 11.1.1`.

Other transitive alerts are fixed by refreshing the lockfile within the parents'
ranges (`pnpm update <package> --depth Infinity`), not by overrides.

## Deploy

### Deploy on AWS

TODO
