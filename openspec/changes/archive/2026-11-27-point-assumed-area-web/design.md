## Context

After `point-default-area-4ha`, every point `FarmData.polygon` carries `areaAssumed` (generated type in `apps/web/src/api/schema.d.ts`, re-exported by `apps/web/src/interfaces/Farm.ts`).

- Report: the farm sheet prints `farmArea(farm, t, language)` under `reportGeneration:attributes:totalArea` ("Superficie total (ha)") through `DataItem` (`apps/web/src/utils/report/sections.tsx:265-276`, `:395-398`).
- Exports: both the GeoJSON feature (`getRowCommonDataAsObject`, `apps/web/src/utils/download.ts:29-37`) and the Excel template row (`farmToTemplateRow`, `apps/web/src/utils/resultsExport.ts:58-73`) take the area from `areaHectares` (`download.ts:20-22`), which has no other caller.
- Manual form: `ManualFarmModal.tsx:52-54` defines `DEFAULT_POINT_AREA_HECTARES = 1` and uses it for the preview radius while the area field is empty or invalid (`:124-127`). The area is mandatory (`ManualFarmModalForm.ts:180`, `ManualFarmFields.tsx:73`).

## Goals / Non-Goals

**Goals:**
- Say in the report when a point's area was assumed.
- Never write an assumed area into an export as if it had been declared.
- Preview 4 ha in the manual form, the same default the API applies.

**Non-Goals:**
- Showing the mark elsewhere in the app (stage 1 table, stage 2 map at `SelectedPolygonsMap.tsx:150`). Proposed as a follow-up if the team wants it.
- Making the manual form's area optional: the form keeps asking for it, since a declared area is better evidence than an assumed one.
- The rest of the TRACES export format (`ProductionPlace`, 6 decimals): EUDR-9 (undp/monbo#201).

## Decisions

1. **Report.** `DataItem` gets an optional `note?: string`, rendered below the value in the existing small light style (`styles.smallLightText`). The farm sheet passes `t("reportGeneration:farmSheet:assumedArea", { area })` only when `farm.polygon.type === "point" && farm.polygon.areaAssumed`. `area` is the farm's hectares formatted for the language without trailing zeros ("4"). New keys go in their own block under `farmSheet` in both locales (the orchestration asks for one block per unit to ease rebases):
   - es: `"assumedArea": "Área supuesta: {{area}} ha, no declarada"`
   - en: `"assumedArea": "Assumed area: {{area}} ha, not declared"`
   *Alternative rejected:* appending the text to the value ("4,00 (supuesta)"): the value column is bold and narrow, and the spec of the issue quotes a sentence of its own.
2. **Exports.** `areaHectares` returns `null` for a point with `areaAssumed` true, and its doc comment says so. Both exports already treat `null` as "no area" (GeoJSON omits `Area`; Excel writes an empty cell). The stale "gives the point 1 ha" comment in `resultsExport.ts:70-72` is corrected. *Alternative rejected:* writing `Area: 4`. TRACES would read it as declared, and a re-upload would turn the assumed area into a declared one, losing the mark.
3. **Manual form.** The preview constant becomes 4 and its comment points to the API's default. It is not imported from anywhere (the web has no copy of API constants and `GET /config` doesn't serve this one); a test pins the 112.84 m radius so a drift is caught.

### API contract / data shape

N/A — this change only reads `areaAssumed`, added by `point-default-area-4ha`.

### Signal trace — `areaAssumed` (consumer side)

- **Emitter:** the API (`point-default-area-4ha`).
- **Consumer:** `FarmSheetPage` (adds the note) and `areaHectares` (drops the area from both exports).
- **State change:** none; read-only.
- **External record:** the PDF/ZIP report and the Excel/GeoJSON files.

## Hazards (Step 2b)

| File | Failure mode | Evidence |
|---|---|---|
| `apps/web/src/utils/report/sections.tsx` | The PDF is rendered by react-pdf in a worker; a style not registered breaks rendering, and the -1/null area sentinel must never print as a value | `sections.tsx:272-276`, `openspec/specs/report-generation/spec.md:171` ("renders every text style it uses"); conflicts with EUDR-2/4/5/6/7 (undp/monbo#192) |
| `apps/web/src/locales/{es,en}/reportGeneration.json` | A key in one locale only fails `locales.test.ts` | `CLAUDE.md` "Testing" |
| `apps/web/src/utils/download.ts` | Also feeds EUDR-9's TRACES export; `Area` must never be a string | `openspec/specs/results-export/spec.md:73-100`, PR #187 |
| `apps/web/src/utils/resultsExport.ts` | Comment only | — |
| `apps/web/src/components/page/uploadData/manualFarm/ManualFarmModal.tsx` | The radius also sets the initial bounds when editing (`:128-133`) | `ManualFarmModal.tsx:128-133` |
| `apps/web/src/test/factories.ts` and other fixtures | Adding a required field breaks `tsc` in every test that writes a point `FarmData` literal | `grep 'type: "point"'` over `src/` |

## Risks / Trade-offs

- [A user who re-uploads an export of an assumed point sees no area in the file] → Intended: it was never declared; the upload assumes 4 ha again and the report says so.
- [`sections.tsx` is touched by five other units] → This change only adds a prop to `DataItem` and one call; it rebases over whatever merged first.
