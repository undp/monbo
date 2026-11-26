## Context

`sampleReports.test.ts` (added in #182, commits `6678b93` and `ec4e421`) holds
`PRODUCTION_GEOJSON_URL` as a literal and rejects `jollymoss` (the dev host) by name.
`apps/web/public/files/examples/README.md` repeats the production URL in its
regeneration command. The two sample PDFs carry the URL in their link annotations; they
are static and only change by regenerating them.

The web tests run with Vitest (`apps/web/vitest.config.mts`, `env` only sets
`NEXT_PUBLIC_API_URL`). Vitest does not load `.env` files into `process.env` for
non-`VITE_` names, so a test reads a variable only if the shell or CI sets it. CI runs
them in the web job's `Test` step (`.github/workflows/ci.yml`, `- name: Test`, job
`Tests, type-check, lint, build`). The repository has no Actions variables today
(`gh api repos/undp/monbo/actions/variables` → `total_count: 0`).

## Goals / Non-Goals

**Goals:** no production URL in code; one place to change it (the repository variable);
CI cannot pass with the variable missing; changing the variable without regenerating the
PDFs turns CI red.

**Non-Goals:** removing the URL from the PDFs (impossible: static files); reading it from
Terraform outputs; a `NEXT_PUBLIC_*` variable (no runtime code reads it).

## Decisions

1. **`SAMPLE_REPORTS_API_URL`, the API's base URL** (no `/download-geojson`, no trailing
   slash; the test strips one if present). Same name in the shell, in CI and in the
   README command, so there is a single name to search for.
   *Rejected:* reusing `NEXT_PUBLIC_DOWNLOAD_GEOJSON_URL`. It is a build-time override of
   the live app; tying the test to it would make a local `.env` for the app change what
   the test expects.
2. **CI source: the repository variable** `vars.SAMPLE_REPORTS_API_URL`, set as `env` on
   the web job's `Test` step only. It is not a secret (the URL is public), so a variable,
   not a secret. *Rejected:* a value in `ci.yml` (still code) or in `vitest.config.mts`
   (code).
3. **Unset behaviour.** An empty string counts as unset (`vars.X` of a missing variable
   is `""`).
   - With `CI` set and the variable unset: a test fails with a message naming the
     variable and where to set it.
   - Without `CI` and unset: the host test is `it.skipIf(...)`, so Vitest reports it as
     skipped, not passed.
   - Always run: 5 links, one sample farm each, every link on one `https` origin, no URI
     on `localhost`/`127.0.0.1`. The `jollymoss` literal goes: in CI the equality with the
     configured URL already excludes dev.
4. **Docs.** The README command becomes
   `NEXT_PUBLIC_DOWNLOAD_GEOJSON_URL="$SAMPLE_REPORTS_API_URL/download-geojson"`, with
   `export SAMPLE_REPORTS_API_URL="$(gh variable get SAMPLE_REPORTS_API_URL -R undp/monbo)"`
   before it. `apps/web/README.md` "Testing" gets one line on the variable.
   `docs/suggested_deployment.md` is the `documenter`'s.

## Data shape / API contract / cross-stack wiring

N/A: no API, model, `schema.d.ts` or runtime env change. The only wiring is CI → test.

## Hazards (Step 2b)

| File | Failure mode | Evidence |
|---|---|---|
| `.github/workflows/ci.yml` | Renaming the job or the step changes the required check names; a missing variable silently skips the check | Required checks `Tests, type-check, lint, build` (CLAUDE.md, Workflow); `vars.X` of an unset variable is `""` → Decision 3 |
| `sampleReports.test.ts` | A skipped host check reads as green locally | `it.skipIf` shows as skipped; CI guard fails |
| `apps/web/public/files/examples/README.md` | The command keeps a literal URL | Task 3.1 |
| `apps/web/README.md` | No known hazard | — |

## Signal tracing

- **Emitter:** the repository variable `SAMPLE_REPORTS_API_URL` (a human sets it in
  GitHub).
- **Consumer:** the web job's `Test` step → `sampleReports.test.ts`, which compares every
  GeoJSON link against it.
- **State change:** CI red when missing or when the PDFs disagree with it.
- **External record:** the PR checks tab; the variable in Settings → Secrets and
  variables → Actions.

## Risks / Trade-offs

- [The variable is created after the PR merges] → every web PR goes red. Mitigation: it is
  a "before merge" manual step, created before this PR's CI runs.
- [Someone runs the tests locally without it] → the host check is skipped, visibly.

## Open Questions

None beyond Puerta 1.
