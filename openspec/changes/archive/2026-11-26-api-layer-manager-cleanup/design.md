## Context

Issue #173 (MB-7 of orchestration #172) lists two leftovers of the layer manager:

1. `DeforestationUnprocessedFarmData` is still defined at `apps/api/app/modules/layer_analysis/models.py:7` and nothing uses it. A search of `apps/api/app`, `apps/api/tests`, `tools/` and `apps/web/src` finds no other reference, and neither `apps/api/openapi.json` nor `apps/web/src/api/schema.d.ts` mention it (no route returns or accepts it).
2. `GET /countries` (`apps/api/app/modules/maps/countries.py:20`) calls `LayersRoot.public_countries()` (`apps/api/app/modules/layers/store.py:829`), which calls `is_public` (`store.py:749`) for every layer of every country. For a layer that passes the in-memory checks, `is_public` calls `LayerStore.has_raster` (`store.py:159`), which does `Path.is_file()` on the share on every call (`store.py:163`). The index itself is cached by mtime and size (`store.py:174-197`), but it still costs a `stat` per call. `GET /maps` filters with the same `is_public` (`apps/api/app/modules/maps/router.py:74`).

The issue asks to measure `GET /countries` before deciding whether to cache `has_raster`.

### Measurement (2026-11-26)

**Live dev API** (`monbo-api.kindisland-03fae591.eastus.azurecontainerapps.io`, share mounted over SMB, 3 countries with 10 public layers: CO 3, CR 3, EC 4). 40 rounds over one kept-alive HTTPS connection from Chile, alternating endpoints:

| Endpoint | p10 | p50 | p90 |
|---|---|---|---|
| `GET /health/live` (no share access) | 126 ms | 127 ms | 210 ms |
| `GET /countries` | 128 ms | 172 ms | 225 ms |
| `GET /maps?country=CO` | 131 ms | 144 ms | 188 ms |
| `GET /maps` | 131 ms | 160 ms | 242 ms |

So the share work of `GET /countries` costs about **45 ms at the median** and almost nothing at p10. The bimodal pattern matches the Linux SMB client's attribute cache (`actimeo`, 1 s by default; `infra/terraform/apps/api.tf:83` doesn't change it): a `stat` repeated within a second is served locally.

**Local count with a simulated slow share** (same layout, `os.stat` instrumented, script in the PR description):

| Request | `stat` calls | from `has_raster` |
|---|---|---|
| `GET /countries` | 22 | 10 |
| `GET /maps?country=CO` | 18 | 3 |
| `GET /maps` | 22 | 10 |

With 1, 3 and 10 ms per `stat`, `GET /countries` takes 30, 87 and 264 ms. The dev numbers (≈45 ms for 22 calls) mean ≈2 ms per uncached `stat`, so `has_raster` accounts for at most ≈20 ms of a ≈170 ms request. The other 12 calls (`is_per_country` twice, `read_registry`, and `read_index` plus `read_categories` per country) stay with or without a raster cache, because they are what keeps the existing index caches correct.

## Goals / Non-Goals

**Goals:**

- Remove the dead model.
- Close the cache question with numbers, and pin the behaviour the decision protects with a test.

**Non-Goals:**

- Caching `has_raster` or any other `stat` of the listings.
- Changing any response: `GET /countries` keeps answering byte for byte as before.

## Decisions

### D1. Don't cache `has_raster`

The saving is at most ≈20 ms per `GET /countries` (≈12 % of the request seen from a browser), on a route the web calls once per page load, and the SMB client already absorbs repeated calls within a second.

The cost is correctness. The listing requirement in `openspec/specs/layer-storage/spec.md` states that `GET /maps` lists only layers "whose raster file exists. This SHALL hold whatever produced the index, including a hand edit of the share", and `is_public`'s docstring calls itself "the read-side guard" for exactly that (`store.py:753-756`). The operations team edits the share by hand and restores files from snapshots (`docs/architecture.md`, recovery table). A cache keyed by the index mtime and the filename, as the issue suggests, would keep listing a layer whose raster was deleted or restored by hand without touching the index. That layer would then fail in analysis as `value: null` for every farm: a swallowed failure the user only sees as "could not be computed".

Alternatives rejected:

- **Cache keyed by index mtime + filename, invalidated by the admin's writes** (the issue's proposal): breaks the hand-edit guarantee above; only the admin's own writes would invalidate it.
- **Time-based cache (e.g. 30 s)**: bounds the staleness, but duplicates what the SMB client already does for 1 s, adds a clock to tests, and still lists a missing raster for the TTL. Not worth ≈20 ms.
- **Fewer `stat` calls elsewhere** (call `is_per_country` once per request): a real but separate optimisation of the other 12 calls, outside this unit's scope. Proposed as a follow-up only if someone sees a latency problem; today there isn't one.

### D2. Pin the guarantee with a regression test

A new test in `apps/api/tests/modules/layers/test_countries_layout.py` lists a country whose only layer has a raster, removes the raster file without touching the index, and asserts the next `GET /maps?country=CO` and `GET /countries` no longer list it. It fails if anyone later adds a cache that the index doesn't invalidate. The scenario goes into the `layer-storage` spec as a delta, without changing the requirement text.

## Hazards (Step 2b)

| File | Failure mode | Evidence |
|---|---|---|
| `apps/api/app/modules/layer_analysis/models.py` | No known hazard. The only risk is a hidden importer or an OpenAPI change, and there is neither: no reference outside the file, and the class is absent from `openapi.json` and `schema.d.ts`. `python -m app.openapi --check` confirms it. | Last touched in #131 (`13265645`), which renamed the contract to `/layer_analysis`. |
| `apps/api/tests/modules/layers/test_countries_layout.py` | The layers root is process-wide (`store.py:863-871`) and `_logged_issues` remembers what it already logged (`store.py:769-781`): a test that builds its own `LayersRoot` without the `country_root` fixture leaks into other tests. Use the fixture, which restores the root (`tests/conftest.py:106-112`). | `tests/conftest.py:97-112` |

## API contract / data shape / cross-stack wiring

N/A: no route, model in the contract, response or web code changes.

## Signal tracing

N/A: the change introduces no signal.

## Risks / Trade-offs

- [The share grows to many more layers and `GET /countries` gets slow] → each layer adds one `stat` (≈2 ms uncached). At 50 layers that is ≈100 ms more. The PR records the numbers so the question can be reopened with data; the guard test then defines what any cache must preserve.
- [Dev numbers taken from Chile, with network jitter] → the comparison is against `/health/live` on the same connection in alternating order, so jitter affects both alike; the local count gives the share-independent number of calls.

## Migration Plan

None. Rollback is a revert.
