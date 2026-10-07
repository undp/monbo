## 1. API models and export

- [x] 1.1 `PolygonSummary` becomes a discriminated union on `type`:
  - point: `details: PointDetails`, `area: float`;
  - polygon: `details: PolygonDetails | None`, `area: float | None`.
  Make sure every producer builds the right variant. `PolygonInconsistency` likewise: `overlap`, `invalid_geometry` and `empty_polygon` (`data: None`)
- [x] 1.2 Ingestion job models: `IngestionJob`, mirroring today's `refresh_job` output (status, phase, progress, error, report, timestamps), plus `JobAccepted` and `JobCancelled`. Set them as `response_model` on `PUT /admin/layers/{id}/raster`, `GET /admin/jobs/{id}` and `DELETE /admin/jobs/{id}`
- [x] 1.3 `create_app(include_admin: bool | None = None)`: `None` keeps today's behaviour; `True` registers the admin router regardless of the environment
- [x] 1.4 `app/openapi.py`: `python -m app.openapi` writes `apps/api/openapi.json` (sorted keys, indent 2, trailing newline); `--check` exits 1 with "run `pnpm contracts`" on a difference. Commit the file
- [x] 1.5 Tests:
  - the export is deterministic and includes `/admin`;
  - `--check` passes on the committed file;
  - the JSON of `/farms/parse`, `/polygons_validation/validate`, `/deforestation_analysis/analize` and the job routes is unchanged.
  Run the regression suite (`expected_results.json`), plus ruff, black and mypy
- [x] 1.6 Make the contract match the responses: `FarmData.polygon` required (it was `None` only while being built), and response models with defaults set `json_schema_serialization_defaults_required`, guarded by a test that no response schema has an optional field

## 2. Web types

- [x] 2.1 Add `openapi-typescript@7.13.0` as an exact devDependency of `apps/web`, and the script `generate:api-types` (`openapi-typescript ../api/openapi.json -o src/api/schema.d.ts`). Generate and commit `src/api/schema.d.ts`
- [x] 2.2 `src/interfaces/*`: replace each API shape with an alias of the generated type, keeping the names. Keep the purely frontend types (`Page`, `SelectionOption`, form state)
- [x] 2.3 Type the `src/api/*` fetch helpers with the generated request and response types
- [x] 2.4 Fix what `tsc --noEmit` reports, e.g. a `null` deforestation value or layer alias, and `region`/`association` as `string | null`. Each fix matches the API's real behaviour. Run tsc, lint and build

## 3. Tooling and CI

- [x] 3.1 Root `package.json`: a `contracts` script (`uv run --directory apps/api python -m app.openapi && pnpm --dir apps/web generate:api-types`)
- [x] 3.2 `.github/workflows/ci.yml`:
  - api job: a step `uv run python -m app.openapi --check`;
  - web job: a step `pnpm run generate:api-types && git diff --exit-code src/api/schema.d.ts`;
  - detection: `apps/api/openapi.json) api=true; web=true ;;` **before** `apps/api/*)`.
  Run actionlint
- [x] 3.3 Docs:
  - `apps/api/README.md` and `apps/web/README.md`: changing a contract (edit the model, then `pnpm contracts`, then commit both files);
  - `docs/architecture.md`;
  - `.claude/skills/pr-review` and `pr-comment-triage`: replace the "mirror the Pydantic model in `src/interfaces/`" convention;
  - `CHANGELOG.md`

## 4. Wrap-up

- [x] 4.1 Run `openspec validate api-contract-codegen`
- [x] 4.2 Commit on `BlancaMunizaga/api-config-and-contracts` (after `api-config-endpoint`, so `/config` is in the contract) and open a PR into `dev` (ask first)
