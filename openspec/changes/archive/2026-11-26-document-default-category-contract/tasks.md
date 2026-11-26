## 1. Contract descriptions

Files: apps/api/app/models/maps.py, apps/api/app/modules/admin/models.py, apps/api/app/modules/maps/router.py, apps/api/tests/test_openapi.py

- [x] 1.1 Write the fix tripwire first: in `apps/api/tests/test_openapi.py`, add
      `test_category_fields_name_the_default_category`, asserting that
      `components.schemas.BaseMapData.properties.categoryId.description` and
      `components.schemas.AdminLayer.properties.category_id.description` of
      `json.loads(openapi.render())` both contain `built-in "deforestation"`. Observe it red on
      the pre-change tree (`uv run pytest tests/test_openapi.py`). Classification: fix tripwire.
      Minimal mutant (post-change): `falsify.mjs --file apps/api/app/models/maps.py
      --find 'built-in "deforestation"' --replace 'built-in category'
      --test apps/api/tests/test_openapi.py`.
- [x] 1.2 `apps/api/app/models/maps.py`: replace the comment above `categoryId` with
      `categoryId: str = Field(description=...)` using the text in design.md, Decision 1 (no
      default). Import `Field`.
- [x] 1.3 `apps/api/app/modules/admin/models.py`: `category_id: str = Field(description=...)`
      on `AdminLayer`, same text, no default.
- [x] 1.4 `apps/api/app/modules/maps/router.py`: update the `categoryId` line of the `GET /maps`
      docstring to the same sentence.
- [x] 1.5 Done when `uv run pytest tests/test_openapi.py` is green, including
      `test_response_fields_are_all_required`.

## 2. Generated contracts and the web copy

Files: apps/api/openapi.json, apps/web/src/api/schema.d.ts, apps/web/src/interfaces/AdminLayer.ts

- [x] 2.1 Run `pnpm contracts` from the repo root; the diff of `openapi.json` and
      `schema.d.ts` contains description lines only.
- [x] 2.2 Remove `DEFAULT_CATEGORY_ID` and its comment from
      `apps/web/src/interfaces/AdminLayer.ts:31-32`.
- [x] 2.3 Done when `uv run python -m app.openapi --check` (apps/api) passes and
      `pnpm exec tsc --noEmit` (apps/web) passes; `grep -rn DEFAULT_CATEGORY_ID apps/web/src`
      returns nothing.

Groups 1 and 2 are disjoint in files; 2.1 depends on group 1.
