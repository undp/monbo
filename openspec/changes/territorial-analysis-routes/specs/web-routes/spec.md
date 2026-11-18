## ADDED Requirements

### Requirement: Stage 2 lives under /territorial-analysis

The territorial analysis stage SHALL be served at `/territorial-analysis` (its results) and `/territorial-analysis/upload-data` (choosing the polygons and the layers), in both languages: without a prefix or with `/es` for Spanish, with `/en` for English, as every other page of the app. Every link, button and in-app redirect that leads to stage 2 SHALL use these paths. No page SHALL be served under `/deforestation-analysis`.

#### Scenario: Stage 2 in Spanish

- **WHEN** the user opens `/territorial-analysis/upload-data` with a country selected
- **THEN** the stage 2 selection page renders in Spanish

#### Scenario: Stage 2 in English

- **WHEN** the user opens `/en/territorial-analysis` with analysis results
- **THEN** the stage 2 results page renders in English

#### Scenario: Navigation after an analysis

- **WHEN** an analysis finishes on `/en/territorial-analysis/upload-data`
- **THEN** the browser goes to `/en/territorial-analysis`

### Requirement: Retired stage 2 URLs redirect permanently

A request for `/deforestation-analysis` or any path below it, with or without a language prefix, SHALL answer a permanent redirect (HTTP 308) to the same path under `/territorial-analysis`. The redirect SHALL keep the language prefix as it was requested (none, `/es` or `/en`), the rest of the path and the query string. It SHALL be answered before the language routing, so the language of the old URL is the language of the new one. Paths that only start with the same letters (for example `/deforestation-analysis-old`) SHALL NOT be redirected.

#### Scenario: Spanish URL with a prefix

- **WHEN** the browser requests `/es/deforestation-analysis`
- **THEN** the response is a 308 to `/es/territorial-analysis`, and the page finally shows in Spanish at `/territorial-analysis`

#### Scenario: English sub-page

- **WHEN** the browser requests `/en/deforestation-analysis/upload-data`
- **THEN** the response is a 308 to `/en/territorial-analysis/upload-data`

#### Scenario: No prefix and a query string

- **WHEN** the browser requests `/deforestation-analysis?source=pdf`
- **THEN** the response is a 308 to `/territorial-analysis?source=pdf`

#### Scenario: Unrelated path

- **WHEN** the browser requests `/deforestation-analysis-old`
- **THEN** it is not redirected to `/territorial-analysis`

### Requirement: Stage 2 texts live in the territorialAnalysis namespace

The texts of stage 2 SHALL live in the i18n namespace `territorialAnalysis` (`locales/es/territorialAnalysis.json` and `locales/en/territorialAnalysis.json`), with the same keys in both languages. Every page, component, worker and test helper that shows stage 2 texts SHALL load that namespace. No namespace named `deforestationAnalysis` SHALL exist.

#### Scenario: Keys used in code exist

- **WHEN** the web's translation tests run
- **THEN** every `t("territorialAnalysis:…")` written in the code has its key, in `es` and `en`

#### Scenario: Report in the worker

- **WHEN** the PDF report is built in its worker
- **THEN** the texts it takes from stage 2 come from the `territorialAnalysis` namespace and none shows as a raw key
