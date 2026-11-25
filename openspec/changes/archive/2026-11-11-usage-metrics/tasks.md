## 1. Event model and writer (API)

- [x] 1.1 `USAGE_DIR` in `app/config/env.py`: optional, unset by default (design decision 3). Document it in `apps/api/README.md`, next to `MAPS_ROOT`.
- [x] 1.2 `app/modules/usage/models.py`: the event models.
  - Server types: `upload`, `validation`, `analysis`. Browser types: `report_requested`, `report_downloaded`.
  - Outcomes: `ok`, `invalid_input`, `server_error`, `error`.
  - The allowed fields only (spec "Events never carry farm data"), with `v: 1`.
- [x] 1.3 `app/modules/usage/writer.py`: `record(event)`.
  - Stamp the UTC time.
  - Write one JSON line to stdout, through a dedicated logger with a plain `%(message)s` handler, no color and no propagation to `app`.
  - When `USAGE_DIR` is set, append the line to `<USAGE_DIR>/<YYYY-MM>/<replica>-<pid>.jsonl` under a process-wide lock, creating the month folder (decision 2).
  - Log any write failure and never raise.
- [x] 1.4 Unit tests for the writer:
  - the file path from the month, from `CONTAINER_APP_REPLICA_NAME` or the host name, and from the PID;
  - two processes write to two files;
  - one line per event;
  - concurrent writes from threads don't interleave;
  - a write failure is logged and swallowed;
  - no file without `USAGE_DIR`.

## 2. Server events (API)

- [x] 2.1 Context headers: parse `X-Monbo-Session` (a UUID), `X-Monbo-Country` (two uppercase letters) and `X-Monbo-Module` (an enum). Invalid values become `None`.
- [x] 2.2 The usage middleware (decision 5).
  - It applies only to `POST /farms/parse`, `/polygons_validation/validate` and `/deforestation_analysis/analize`.
  - It maps the status code to the outcome, and an unhandled exception to `server_error`, then re-raises.
  - It adds `request.state.usage` counts on `ok`, and records one event.
  - Register it in `create_app`.
- [x] 2.3 Counts from the routes:
  - `/parse`: `farms`, `polygons` and `points` from the returned farms;
  - `/validate`: `farms`, and `invalidFarms` from `farmResults`;
  - `/analize`: `farms`, `maps`, and the body's `country`, which wins over the header.

  Add a `Request` parameter where a route needs one.
- [x] 2.4 Tests:
  - one event per call with the right counts, for each route;
  - a 400 from `/parse` and a 422 before `/analize` recorded as `invalid_input`;
  - an unhandled exception recorded as `server_error`, and still a 500;
  - requests without headers and with invalid ones;
  - an event never contains a farm's ID, producer or coordinates (assert on the recorded line for a farm with recognizable values).
- [x] 2.5 Check that `usage/` under the layers root isn't listed as a country by the layers store (spec "Not a country folder").

## 3. `POST /events` (API)

- [x] 3.1 `app/modules/usage/router.py`: `POST /events` (decision 6).
  - Check `Content-Length` and the bytes read against the 2 KB cap (413) before parsing.
  - Use a Pydantic body with `extra="forbid"`, the closed `type`, `outcome` and `format` fields, `farms` between 0 and 100,000, and `format` required only for `report_downloaded`.
  - Record the event with `source: "browser"` and answer 204.
- [x] 3.2 Register the router in `create_app` and `app/modules/__init__.py`, outside the admin module (no Origin check).
- [x] 3.3 Tests: a valid event (204, one line), an unknown type, an extra field (`at`), a missing `format`, `format` on `report_requested`, an oversized body (413), and an invalid session.

## 4. `GET /admin/usage` (API)

- [x] 4.1 `app/modules/usage/store.py`: read a month's events from every `*.jsonl` file in its `YYYY-MM` folder, line by line. Skip lines that don't parse or don't validate. This module and the writer are the only code that touches the event files (design decision 1, "The way back").
- [x] 4.2 `app/modules/usage/aggregate.py`.
  - Fold events into day summaries: per UTC day and country, the counters of every figure and the session IDs with their steps.
  - Build the totals, the country blocks (`unknown` for no country) and the ISO-week blocks from the day summaries in `[from, to]`, with the fields of spec "What the aggregates count".
- [x] 4.3 `app/modules/usage/rollup.py`: the monthly rollups (decision 8, spec "Closed months are summarized once").
  - `rollups/<YYYY-MM>.json` holds a month's day summaries and a version constant.
  - For a closed month, load it, or build it from the events when it is missing, doesn't parse, has another version, or the signature of the month's event files (name, size and modification time of each) differs from the one it was built from.
  - Write to a temporary file in `rollups/` and rename it into place. Log a write failure and answer from the events.
  - Read the current month from its events.
- [x] 4.4 `GET /admin/usage` in the admin module.
  - Sync, so the share reads run in the threadpool.
  - `require_admin`, not filtered by the session's country (decision 9).
  - `from`/`to` default to the last 30 days; `from` > `to` or a range over 366 days gets 422.
  - Without `USAGE_DIR`, 503.
  - Typed response models.
- [x] 4.5 Tests:
  - the average, distinct sessions, PDF versus ZIP, errors split by kind, `unknown` country and a torn line, on fixture files;
  - the default range on a fixed date;
  - 401 without a token;
  - a CR token sees PE's figures;
  - 422 for a bad range;
  - 503 without `USAGE_DIR`;
  - rollups: built on the first request for a closed month and reused on the next, without reading its events; rebuilt after an event file changes, on a version change and when the file is corrupt; never built for the current month;
  - the same response with and without `rollups/`;
  - `rollups/` isn't read as a month of events;
  - a failed rollup write still answers.
- [x] 4.6 Regenerate `apps/api/openapi.json` and `apps/web/src/api/schema.d.ts` (`api-contracts`).

## 5. Session and headers (web)

- [x] 5.1 The session ID next to the selected country, in `sessionStorage` (`utils/usageSession.ts`, outside `DataContext` so the `@/api` modules can use it without a circular import).
  - `crypto.randomUUID()` on first use (a `getRandomValues` fallback outside secure contexts), kept in `sessionStorage`, or in memory when it is unavailable.
  - Not reset on a country change.
  - Expose a `usageHeaders(country, module?)` helper that returns the three headers.
- [x] 5.2 Send the headers:
  - `api/farms.ts` `generateFarmsData` takes the module from the calling page (`PolygonsValidationUploadDataPageContent`, `DeforestationAnalysisUploadDataPageContent`);
  - `api/polygonValidation.ts`;
  - `api/deforestationAnalysis.ts` `analizeDeforestation`.
- [x] 5.3 Unit tests:
  - the ID persists across remounts in the same storage, and changes with new storage;
  - it is kept on a country change;
  - each API call sends the headers.

## 6. Report events (web)

- [x] 6.1 `api/usageEvents.ts`: `sendUsageEvent(event)` posts to `${NEXT_PUBLIC_API_URL}/events` with `keepalive: true`, fire and forget, and swallows errors. Add the URL to `config/env.ts` like the others.
- [x] 6.2 `reportGeneration/PageFooter.tsx`: send `report_requested` with the selected farms count, only when the selection isn't empty.
- [x] 6.3 `hooks/useDeforestationReportDownload.tsx`: send `report_downloaded`.
  - `downloadCompleteReport` sends `pdf`; `downloadSeparatedReports` and `downloadLargeReport` send `zip`.
  - The outcome is `ok` after `saveAs` and `error` in the snackbar branch.
  - Nothing is sent on a cancellation, a terminated worker or `MapLayerChangedError` (decision 7).
- [x] 6.4 Unit tests:
  - the requested event with its count, and none on an empty selection;
  - each download's format and outcome;
  - no event on a cancel or on a layer change;
  - a failing `/events` doesn't surface an error.

## 7. Admin usage page (web)

- [x] 7.1 Add `@mui/x-charts` with `pnpm` in `apps/web` (decision 10): version 9, whose peer range covers `@mui/material` 7. MUI X numbers its majors apart from Material.
- [x] 7.2 `api/adminUsage.ts`: `getAdminUsage(token, from, to)`, through the shared admin `request`, typed from `schema.d.ts`. Handle a 401 like the other admin calls, and a 503 as "not configured".
- [x] 7.3 `app/[locale]/admin/usage/page.tsx` and `components/page/admin/AdminUsagePageContent.tsx`:
  - the range presets and custom dates;
  - the total tiles;
  - successes and errors per step;
  - the country table with country names from the registry and "Unknown country";
  - the weekly `LineChart`;
  - the "sessions, not people" note, and the "Reported by the browser" and "Recorded by the server" labels;
  - the empty and not-configured states.
- [x] 7.4 The admin header navigation, "Layers" and "Usage", with the current item marked, shown only once logged in (modified "Admin UI").
- [x] 7.5 `en` and `es` texts for the page and the navigation. Format numbers and dates in the UI language.
- [x] 7.6 Unit tests for the page:
  - tiles and table from a fixture response;
  - "—" for a `null` average;
  - the empty state;
  - the not-configured state;
  - the navigation's current item.

## 8. Infra and docs

- [x] 8.1 `infra/terraform/apps/api.tf`: an `env` block with `USAGE_DIR = "/mnt/maps/usage"`, next to `MAPS_ROOT`, with a comment.
- [x] 8.2 Local development: document setting `USAGE_DIR` to a gitignored folder (e.g. `apps/api/.usage/`) and add it to `apps/api/.gitignore`.
- [x] 8.3 `infra/README.md` or `docs/`:
  - where usage events live, and that they are in the share's daily backup;
  - the stdout copy in Log Analytics (30 days);
  - how to delete old months by hand;
  - that `rollups/` is a cache that can always be deleted.
- [x] 8.4 Run the API and web tests, type-check and lint. Check the usage page by hand against a local `USAGE_DIR` after uploading, analyzing and downloading a report in both formats, and with a copied past-month folder so a rollup gets built.

## 9. Usage page redesign

- [x] 9.1 Title "App usage" without the overline or the session's country (`AdminPageContainer` `countryInTitle={false}`).
- [x] 9.2 `usageChartData.ts`: country shares with fixed colors and "Other", the funnel, the outcomes by step and the weekly series, with unit tests.
- [x] 9.3 `UsageCharts.tsx`: tile sparklines, country donuts with percentages, funnel, stacked outcomes and the weekly trend.
- [x] 9.4 The page: tiles with icons and sparklines, the donuts with a shared legend, the funnel and outcomes side by side, the trend and the country table. `en`/`es` texts and page tests updated.

