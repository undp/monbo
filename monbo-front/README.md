# Monbo Frontend

This is the frontend application for Monbo, built with [Next.js 15](https://nextjs.org/docs), a powerful React framework for production.

## Project Structure

```
monbo-front/
├── public/          # Static files
├── src/
│   ├── api/        # API client and services
│   ├── app/        # Next.js app router pages
│   ├── components/ # Reusable React components
│   ├── config/     # Configuration files
│   ├── context/    # React context providers
│   ├── hooks/      # Custom React hooks
│   ├── interfaces/ # TypeScript interfaces
│   ├── locales/    # i18n translation files
│   └── utils/      # Utility functions
```

## Running the Application

There are many ways to run the frontend application. In any case the frontend will be available at `http://localhost:3000`.

### 1. Using Docker for development mode

You can run the frontend in a Docker container in development mode. The source code will be mounted as a docker volume. This approach supports hot-reloading.

First, you need to create a `.env` or `.env.development` file at the `monbo-front` directory containing the environment variables (please use the `.env.development.example` file as a template).
Please follow the file name convention, because it is used by Nextjs to load them automatically.
Then, execute the following command:

```sh
cd monbo-front
docker build -f Dockerfile.dev -t monbo-front-dev .
docker run -d -p 3000:3000 --name monbo-front-dev-container -v $(pwd):/app monbo-front-dev
```

### 2. Using Docker for production mode

You can build and run the productionimage in a Docker container. Note that this approach does not support hot-reloading.

First, you need to create a file at the `monbo-front` directory containing the environment variables (please use the `.env.production.example` file as a template). In this case, the file name convention is not required. Then, execute the following command:

```sh
cd monbo-front
docker build -f Dockerfile.prod -t monbo-front-prod .
docker run -d --env-file <env-file-relative-path> -p 3000:3000 --name monbo-front-prod-container monbo-front-prod
```

### 3. Run Next.js in development mode

If you don't want to use Docker, you can run the NextJS development server with hot-reloading.

First, you need to create a `.env` or `.env.development` file at the `monbo-front` directory containing the environment variables (you can use the `.env.development.example` file as a template).
Please follow the file name convention, because it is used by Nextjs to load them automatically.

Install the dependencies and run the development server:

```sh
pnpm install
pnpm dev
```

### 4. Start the Next.js production server

This will start the NextJS production server.

First, you need to create a `.env` or `.env.production` file at the `monbo-front` directory containing the environment variables (you can use the `.env.production.example` file as a template).
Please follow the file name convention, because it is used by Nextjs to load them automatically.

Install the dependencies and run the production server:

```sh
pnpm install
pnpm build
pnpm start
```

### 5. Run the compiled Next.js in production mode

This will build the NextJS standalone application and run the generated Node server.

First, you need to create a `.env` or `.env.production` file at the `monbo-front` directory containing the environment variables (you can use the `.env.production.example` file as a template).
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

### Testing

There are no tests for this project yet.

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

1. Create a new branch from `main`
2. Make your changes
3. Submit a pull request
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
```

### Environment Variables

```sh
NEXT_PUBLIC_GET_MAPS_URL=                       # URL to get available maps for deforestation analysis

NEXT_PUBLIC_POLYGON_VALIDATION_PARSER_URL=      # URL to parse excel file data into valid Farm objects for polygon validation module
NEXT_PUBLIC_POLYGON_VALIDATION_URL=             # URL to execute polygons validation and find inconsistencies
NEXT_PUBLIC_DEFORESTATION_ANALYSIS_PARSER_URL=  # URL to parse excel file data into valid Farm objects for deforestation analysis
NEXT_PUBLIC_DEFORESTATION_ANALYSIS_URL=         # URL to execute deforestation analysis
NEXT_PUBLIC_DEFORESTATION_ANALYSIS_TILES_URL=   # URL to get map tiles with deforestation data drawn on them
NEXT_PUBLIC_GCP_MAPS_PLATFORM_API_KEY=             # Google Maps API key
```

The endpoints of each module are defined as environment variables because this project is modularized and each module has its own backend service. You could use your own backend services by changing the environment variables and following the same structure for the requests and responses.

### Architecture Decisions

- Material UI for consistent design system
- Emotion for CSS-in-JS styling
- React Query for server state management
- i18next for internationalization
- Google Maps for mapping functionality

## Deploy

### Deploy on AWS

TODO
