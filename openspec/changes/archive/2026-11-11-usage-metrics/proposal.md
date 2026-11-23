## Why

Nobody can tell today how Monbo is used: how many people upload farms, how big their uploads are, how many go on to the deforestation analysis, or how many reports come out of it. The API only logs errors, and the reports and Excel files are built in the browser, so no server log sees them. The people who want these numbers don't have Azure access, so the answer has to live in the app: the admin pages.

## What Changes

- **An anonymous session ID.** The web keeps a random ID in `sessionStorage`, next to the selected country, and sends both as headers to `/farms/parse`, `/polygons_validation/validate` and `/deforestation_analysis/analize`. No cookie, nothing that outlives the browser session. The dashboard counts **sessions**, not people: without a login, people can't be counted.
- **Server-recorded events** for the three steps the API sees, with their outcome, success or error, counted separately:
  - `upload`: farms, polygons and points, and the module;
  - `validation`: farms, and farms not valid;
  - `analysis`: farms, and layers.
- **Browser-reported events** through a new public `POST /events`:
  - `report_requested`: the "Generate report" button, after the farms are selected, with the number of farms;
  - `report_downloaded`: a finished download, as one PDF (`pdf`) or as a ZIP of one PDF per farm (`zip`), with its outcome and number of farms.

  The endpoint has no rate limit. It only takes a closed list of events, with a size cap. Anyone can send it fake events, so the dashboard labels these figures "reported by the browser".
- **No farm data in any event:** a timestamp, the country, the session, the outcome and counts. Never producer names, IDs, coordinates or file names.
- **Storage on the layers share**, which the API already mounts and writes to: one JSON line per event, appended to `usage/<YYYY-MM>/<replica>-<pid>.jsonl`. Each event is also written to stdout, so Log Analytics keeps a copy. No database, Azure SDK, identity or new infrastructure: a managed PostgreSQL would cost about USD 16 a month per environment, plus a VNet and Docker for local development, for a few MB of events a year. The raw events can be loaded into a database later if another feature needs one.
- **Monthly rollups.** The first request that needs a closed month summarizes it once into `usage/rollups/<YYYY-MM>.json`, and later requests read only that summary. A year's range then takes a second or two even at tens of thousands of sessions a month, instead of about 15 seconds when every line is read again. The rollups are a cache: they are rebuilt when a month's events change, and can always be deleted.
- **A usage page in the admin**, `/[locale]/admin/usage`, for any logged-in admin. It shows a date range, the totals across all countries, a table by country and a weekly trend. Every country's admin sees every country's numbers. It is the first admin view that isn't limited to the session's country.
- **A navigation between "Layers" and "Usage"** in the admin pages.

## Capabilities

### New Capabilities

- `usage-tracking`: which events are recorded, by whom (API or browser), what each one carries and never carries, the session ID and country headers, the public `POST /events`, and where events are stored.
- `usage-dashboard`: `GET /admin/usage` and its aggregates (sessions, uploads, average polygons per upload, analyses, reports requested and downloaded by format, errors per step), overall and by country, and the admin usage page.

### Modified Capabilities

- `layer-administration`: the "Admin UI" requirement lists the admin pages and their header. It gains the usage page and a navigation between layers and usage.

## Impact

- **API:**
  - a new `app/modules/usage` (event models, the event writer, `POST /events`);
  - event recording in `farms/router.py` (`/parse`), `polygons_validation/router.py` (`/validate`) and `deforestation_analysis/router.py` (`/analize`);
  - `GET /admin/usage` in the admin module;
  - a `USAGE_DIR` setting in `app/config/env.py`.
- **Web:**
  - the session ID next to the selected country (`DataContext`), and the headers in `api/farms.ts`, `api/polygonValidation.ts` and `api/deforestationAnalysis.ts`;
  - the events from `reportGeneration/PageFooter.tsx` and `hooks/useDeforestationReportDownload.tsx`;
  - the admin usage page, the admin navigation, and `en`/`es` texts.
- **Contracts:** `apps/api/openapi.json` and `apps/web/src/api/schema.d.ts` are regenerated.
- **Infra:** one environment variable on the API container app (`USAGE_DIR=/mnt/maps/usage`). The share, its mount and its daily backup don't change.
- **Privacy:** no cookies, no IP stored, no farm content. The session ID only lives as long as the browser tab.
