## Context

Monbo has no usage data.
- **The API** logs to stdout with `app.config.logger` (colored lines with a timestamp prefix), and a few `print()` calls. On Azure, stdout lands in the Log Analytics workspace, in `ContainerAppConsoleLogs_CL`, kept 30 days (`log_retention_days`). Nothing in it says who did what.
- **The browser builds the outputs.** The PDF report renders in a worker (`workers/reportPdf.worker.tsx`) and the Excel files in `utils/excel.ts`. The API only sees `/generate-image`, once per farm and layer, which can't tell one report from another.
- **No users.** There is no login and no cookie. The selected country lives in `sessionStorage` (`DataContext`), and every module page requires one (`country-selection`).
- **The admin** authenticates one passkey per country (`admin-authentication`). Its routes only touch the session's country.
- **Storage.** The API has no database. It mounts the layers share at `/mnt/maps` with write access (the admin writes `countries.json`, layers and jobs there). It runs a single replica (`infra/terraform/apps/api.tf`), and the share has a daily backup.

The people who want the numbers have no Azure access. They do have an admin passkey, or can be given one.

## Goals / Non-Goals

**Goals:**
- Count, overall and by country, over a date range:
  - sessions that upload, validate and analyze;
  - uploads and the average number of farms per upload;
  - analyses;
  - reports requested, and reports downloaded as one PDF or as a ZIP;
  - successes and errors of each step.
- Show them in the admin, to any logged-in admin.
- Keep farm data out of the events: no names, IDs, coordinates or file names.
- Add no database, cloud SDK, identity or infrastructure.

**Non-Goals:**
- **Counting people.** Without a login, a session is the closest thing (decision 4).
- **Auditable report figures.** The browser reports them, and `POST /events` is public and has no rate limit (decision 6).
- **Other downloads and steps:** the Excel and GeoJSON downloads, the geo file reads (`/farms/import`), tiles and map images. They can be added as event types later.
- **Real-time dashboards, alerts or exports** of the raw events.
- **Deleting old events.** They are a few MB a year (Risks).

## Decisions

### 1. Events in JSONL files on the layers share

Each event is one JSON line, appended to `<USAGE_DIR>/<YYYY-MM>/<replica>-<pid>.jsonl` (decision 2). The month is the event's UTC month. `GET /admin/usage` aggregates the months that overlap the requested range in Python, from a rollup for each closed month and from the raw lines for the current one (decision 8).

```json
{"v":1,"at":"2026-11-09T14:03:12Z","type":"analysis","outcome":"ok","country":"CR","session":"3f1c…","farms":120,"maps":3}
```

**Expected volume.** There is no usage data yet. A full flow records about five events (upload, validation, analysis, report requested, report downloaded), of about 220 bytes each:

| Scenario | Sessions a month | Events a year | Size a year |
|---|---|---|---|
| Low | 300 | 18,000 | ~4 MB |
| Medium | 3,000 | 180,000 | ~40 MB |
| High | 30,000 | 1.8 million | ~400 MB |

The product owner expects the low scenario, and at most the medium one. Reading every line would be fast enough there; the rollups (decision 8) are kept as headroom.

**Alternatives.** Costs are USD a month at the high volume, in `eastus2`, approximate as of November 2026; check them in the Azure pricing calculator.

| Store | Cost | Aggregation | What it adds |
|---|---|---|---|
| **JSONL on the share** (chosen) | < 1, in SMB writes | Python, over rollups (decision 8) | Nothing |
| Log Analytics, queried from the API (`azure-monitor-query`) | ~0.10 of ingestion, plus retention | KQL | A managed identity with the Log Analytics Reader role; the Azure SDK in the image, which keeps it out on purpose (`azure_registry.py` is CLI only); a fake for local development. Data shows up minutes late. Retention past 30 days applies to the whole `ContainerAppConsoleLogs_CL` table, not just the events. |
| Append Blob, in the existing storage account | < 1 | Same as JSONL | `azure-storage-blob`, an identity, and Azurite locally. Atomic appends from several writers, which a single replica doesn't need. |
| Table Storage, in the existing storage account | Cents | Same as JSONL, paged over HTTP | The same SDK, identity and Azurite. No server-side aggregation. |
| PostgreSQL Flexible Server, Burstable B1ms | ~16 per environment: ~12 of compute and ~4 for the 32 GiB minimum of storage. About 32 for dev and prod. | SQL | See below |
| Azure SQL Database, free offer | 0, within 100,000 vCore-seconds a month | SQL | See below |
| Cosmos DB, free tier | 0 if the subscription's single free-tier account is unused | Poor: no direct `COUNT(DISTINCT)`, and a year's scan spends RU against the 1000 RU/s cap | `azure-cosmos` and an identity |

*PostgreSQL.* The bill is the smallest part of its cost:
- **Network.** The Container Apps environment has no VNet (`infra/terraform/apps/main.tf`). A private server means recreating the environment in a VNet, which changes its default domain and so the API and web URLs. The other way is a public endpoint with the "Allow Azure services" rule, which lets in any Azure IP and leaves the password or Entra as the only barrier.
- **Local development.** `pnpm dev` runs without Docker today. Every developer would need Docker or a local Postgres, and the tests a database or a fake.
- **Operations.** Migrations, a connection secret, version upgrades and restore drills, for the first stateful service in an app that has none.

It pays off only when another feature needs a database too.

*Azure SQL free offer.* 100,000 vCore-seconds at the 0.5 vCore minimum is about 55 hours awake a month, and each wake-up keeps the database awake for at least the auto-pause delay. Events spread over the working day of several countries use it up by mid-month. From then on the database either pauses until the next month and loses events, or bills at serverless rates. Resuming also takes tens of seconds, so writes couldn't run in the request and would need a buffer, and the image would need an ODBC driver. It is only free with batched writes, which is more complex than the JSONL.

*Why the share wins:* it is mounted, writable and backed up already, and it works the same against a local folder. The registry already lives there as a JSON file, so this follows the repo's way of storing things. At the high volume it stays under a dollar a month and, with rollups, answers a year's range in a second or two.

*The way back.* The raw events are the source of truth, and only the usage module reads or writes them: the writer (decision 2) and the reader behind the aggregation (decision 8). If a database is ever worth it, the JSONL files load into it with one `COPY`, and nothing outside that module changes.

### 2. One file per process, appended under a lock

The file name is the replica and the process: `<replica>-<pid>.jsonl`. The replica is `CONTAINER_APP_REPLICA_NAME`, which Azure Container Apps sets, or the host name outside Azure. No two processes then write to the same file.
- **Replicas:** scaling out needs no change.
- **Worker processes:** production runs one uvicorn process (`apps/api/Dockerfile.prod`), but `pnpm start` in `apps/api` runs 12 workers. An in-process lock doesn't coordinate processes, and appends from several processes to one file over SMB can interleave.

Within the process, a lock serializes the writes from the threadpool. Each write opens the file in append mode, writes the line and closes it. A crash can leave a torn last line, and the reader skips any line that doesn't parse. A restart starts a new file when the PID changes; the reader reads every file of the month, so that costs nothing.

*Alternative: a single shared file.* Appends from several SMB clients to one file can interleave, and the share offers no reliable cross-client lock.

### 3. `USAGE_DIR`, separate from `MAPS_ROOT`

Events are written only when `USAGE_DIR` is set. Production sets it to `/mnt/maps/usage`.
- **Not a country folder:** `usage` isn't a two-letter uppercase code, so the layers store never reads it as a country.
- **Unset:** events still go to stdout, and `GET /admin/usage` answers 503 "usage metrics aren't configured". The page shows that message.

*Alternative: always `<MAPS_ROOT>/usage`.* Locally, `MAPS_ROOT` often points at the Git-tracked `apps/api/app/maps`. Events would dirty the repository, the way admin writes already do (the API warns about it at startup).

### 4. An anonymous session ID in `sessionStorage`

The web creates a random UUID (`crypto.randomUUID()`, or `crypto.getRandomValues` outside secure contexts) the first time it needs one. It keeps it in `sessionStorage`, next to the selected country, and reuses it for the life of the tab. It isn't reset when the country changes. The code lives in `utils/usageSession.ts`, not `DataContext`: the `@/api` modules send it, and `DataContext` already imports them.

*Alternative: `localStorage`.* It would count browsers across visits, but a persistent identifier on the device can require consent. It still wouldn't count people: the same person on a laptop and a phone counts twice.

*Alternative: the IP address.* It identifies networks, not people, and it is personal data.

*Trade-off:* two tabs count as two sessions. The dashboard says "sessions", never "users" or "people".

### 5. The server records its steps in one middleware; routes add the counts

A middleware wraps the three tracked routes: `/farms/parse`, `/polygons_validation/validate` and `/deforestation_analysis/analize`.
- **Before the route:** it reads the context headers.
- **After the response:** it writes one event. The outcome follows the status code: `ok` below 400, `invalid_input` from 400 to 499, `server_error` from 500 on.
- **The counts:** the route stores them in `request.state.usage`, for example the farms, and the farms not valid. The middleware adds them to the event.

The middleware sees every outcome, including a 422 that FastAPI raises before the route runs and an unhandled exception. That is why the error counts are complete. The route stays in charge of its own counts.

*Alternative: record from each route in a `try/except`.* That misses the 422 from request validation, and repeats the same code in three routes.

**The headers**, all optional:

| Header | Value | When it is invalid |
|---|---|---|
| `X-Monbo-Session` | a UUID | dropped (`null`) |
| `X-Monbo-Country` | a two-letter code | dropped |
| `X-Monbo-Module` | `polygons-validation` or `deforestation-analysis`, only on `/parse` | dropped |

For `/analize`, the country in the body wins over the header. The requests are already JSON POSTs with a CORS preflight, and the API allows any header. No CORS change is needed.

### 6. `POST /events` for the browser, open and capped

The route takes one event: `{type, outcome, session, country, farms, format}`.
- **The list is closed:** `report_requested`, and `report_downloaded` with `format` set to `pdf` or `zip`. Pydantic validates the body, and the route rejects unknown types and extra fields.
- **The server stamps the time.** The client's clock is never used.
- **Bodies over 2 KB get 413**, checked before parsing.
- **The answer is 204.**
- **No rate limit and no Origin check:** the product owner chose an open endpoint.

The dashboard labels these figures "reported by the browser", and the server's figures "recorded by the server".

The web sends events with `fetch(url, { method: "POST", keepalive: true })`, fire and forget. Errors are ignored and never shown to the user. `keepalive` lets the request outlive a page change, as `navigator.sendBeacon` would. Unlike a beacon, it supports a cross-origin `application/json` body with a CORS preflight.

### 7. Which report events, from where

- **`report_requested`:** in `PageFooter.onGenerateReportClick`, when at least one farm is selected, with `farms = selectedFarms.length`.
- **`report_downloaded`:** in `useDeforestationReportDownload`:

  | Function | `format` |
  |---|---|
  | `downloadCompleteReport` | `pdf` |
  | `downloadSeparatedReports` | `zip` |
  | `downloadLargeReport` | `zip` |

  The outcome is `ok` after `saveAs`. It is `error` where the hook shows the error snackbar.
- **Not reported:**
  - a cancelled large report;
  - a worker stopped because the user left the page;
  - `MapLayerChangedError`, which sends the user back to re-run the analysis.

  None of them is a failed download.

### 8. Aggregation on request, from monthly rollups

`GET /admin/usage?from=YYYY-MM-DD&to=YYYY-MM-DD` takes UTC days, both included. Without parameters it covers the last 30 days. The range can't exceed 366 days, or the route answers 422. The route is sync, so the share reads run in the threadpool.

It reads two kinds of input:
- **Closed months** (before the current UTC month): a rollup, `<USAGE_DIR>/rollups/<YYYY-MM>.json`. For each UTC day and country, it holds the counters of every figure and the session IDs seen, with the steps each one took. Distinct sessions over any range come from the union of its days' IDs, so they stay exact. At the high volume a rollup is 1 to 2 MB, mostly session IDs.
- **The current month:** the raw lines.

**The rollup is a cache, built lazily.** The first request that needs a closed month without a valid rollup builds it from the raw lines. It writes it to a temporary file and renames it, so two concurrent requests can only write the same content. A rollup is rebuilt when:
- its version differs from the code's, because the figures changed;
- its month's event files changed since it was built (a file added or removed, or with another size or modification time), because of a late write or a file restored by hand. The rollup stores that signature of the files it was built from;
- it doesn't parse.

No scheduler is needed. The raw files stay the source of truth, so deleting `rollups/` is always safe. `rollups` doesn't match `YYYY-MM`, so the reader never takes it for a month of events.

Estimated time for a one-year range on the share:

| | Low | Medium | High |
|---|---|---|---|
| Read every line on each request | < 0.2 s | ~2 s | ~15 s (~9 s of parsing, 5 to 7 s of SMB reads) |
| Monthly rollups, raw lines for the current month | < 0.1 s | < 0.5 s | ~1 to 2 s, mostly the current month |

*Alternative: read every line on each request.* It is simpler and fine up to the medium volume. At the high volume, the page takes 15 seconds.

*Alternative: daily rollups.* Each SMB open costs 5 to 10 ms, so a year of daily files spends 2 to 4 s just opening them.

*Alternative: DuckDB over the JSONL files.* It aggregates with SQL, vectorized, and adds about 50 MB to the image. It stays as the next step if rollups ever fall short: closed months could then be compacted to Parquet.

It returns `totals`, `byCountry` and `weekly`, with the same block shape in each:

```text
upload:     ok, errors{invalid_input, server_error}, sessions, farms, polygons, points, avgFarmsPerUpload
validation: ok, errors{…}, sessions, farms, invalidFarms
analysis:   ok, errors{…}, sessions, farms
reports:    requested, requestedSessions, downloaded{pdf, zip}, downloadErrors   (source: browser)
sessions:   distinct sessions with any event
```

- **Sessions** are distinct non-null session IDs. Events without one count in the totals but not among the sessions.
- **Events without a country** are grouped as `unknown`.
- **The weeks** are ISO weeks (Monday to Sunday, UTC).

The response is the same whether a month comes from its rollup or from its raw lines.

### 9. Any admin sees every country

`GET /admin/usage` requires a valid admin token, like every admin route, but doesn't filter by the token's country. The product owner wants each country to see the others' numbers. It is the first admin route that isn't limited to the session's country, and the spec says so.

### 10. The page: tiles, charts and a table, with `@mui/x-charts`

The page lives at `/[locale]/admin/usage`, titled "App usage", without the "Layers admin" overline or the session's country. It shows:
- a date range, with presets (30 days, 90 days, this year) and custom dates;
- tiles with the totals, each with an icon and a weekly sparkline;
- one donut per metric (sessions, uploads, analyses, reports downloaded) with each country's percentage on its slice and as text below;
- a usage funnel (sessions that uploaded, analyzed and requested a report, as a share of all sessions);
- successes and errors by step, as stacked bars;
- the weekly trend as a line chart of sessions, analyses and downloaded reports;
- a table with one row per country.

The colors were checked with the dataviz validator (colorblind and normal-vision separation on the light surface): five fixed country slots (blue, orange, aqua, yellow, magenta), so a country has the same color in every donut, and a neutral "Other" for the rest and the unknown country; a one-hue blue ramp for the funnel; blue, orange and red for successful, invalid input and failed. Donuts are kept to at most six slices, and their percentages are also written as text, since a thin slice has no room for its label.

The chart uses `@mui/x-charts`, the MIT community package. MUI X numbers its majors apart from Material: version 9 is the one whose peer range covers `@mui/material` 7. Its labels and numbers follow the UI language.

*Alternative: tables only.* That means no new dependency, but tables don't show a trend or each country's share at a glance; the table stays as the detail and the accessible view of the charts.

The admin header gains a two-item navigation, "Layers" and "Usage".

## Risks / Trade-offs

- **[Fake browser events inflate the report figures]** → The figures are labelled "reported by the browser". The server-recorded steps can't be faked without real requests.
- **[An open `/events` can fill the share]** → Each event is capped at 2 KB, and the share has a quota. At 1 KB an event, filling 1 GB takes a million requests. If it happens, a per-IP limit like the login's can be added without changing the contract.
- **[The share is unreachable when an event is written]** → The write failure is logged and the request carries on. The event is lost, but the stdout copy keeps it in Log Analytics for 30 days.
- **[A torn line after a crash]** → The reader skips lines that don't parse.
- **[Session counts are approximate]** → Two tabs count twice. A client cached from before the change sends no session ID: its events count in the totals but not among the sessions. The UI says "sessions".
- **[A rollup gets out of date]** → It is rebuilt when its month's event files change, or when its version changes (decision 8). Deleting `rollups/` rebuilds them all.
- **[Usage grows past the high volume]** → The current month, read raw, becomes the slow part. DuckDB and Parquet, or a database loaded from the JSONL files, are the next steps (decisions 1 and 8). The response doesn't change.
- **[A country's admin sees the other countries' numbers]** → This is the requested behavior. The figures carry no farm data.

## Migration Plan

1. **Deploy the API first.** The headers are optional, so the current web keeps working, and its events are recorded without a session.
2. **Set `USAGE_DIR=/mnt/maps/usage`** on the API container app, in the same deploy.
3. **Deploy the web.** Sessions, countries and report events start arriving.

**Rollback:** remove the middleware and the routes, or unset `USAGE_DIR`. The event and rollup files left on the share are harmless and can be deleted by hand.

## Open Questions

- Should the Excel and GeoJSON downloads also count as "reports" later? They are left out for now.
