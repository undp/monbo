## 1. Spanish locales

- [x] 1.1 `common.json`: neutral vocabulary ("calce", "Click", "llena"), sentence case and articles ("Tipo de cultivo"), errors as "No se pudo …", the country-change warning without "deforestación", and the testing-environment warning split into two sentences
- [x] 1.2 `home.json`: the "same data" modals with an active voice and "análisis territorial"; the landing's "superposiciones" → "traslapes" (Puerta 1)
- [x] 1.3 `deforestationAnalysis.json`: "capa de mapa" → "capa", "Detalles de las capas", "Fecha del contenido", and the satellite disclaimer without "deforestación"
- [x] 1.4 `polygonValidation.json`: "Guardar cambios", "Mensaje del sistema", and the export sheet names (new keys)
- [x] 1.5 `reportGeneration.json`: "Fecha del reporte", "Elige las capas que quieres incluir", and the empty-selection message without "Por favor"
- [x] 1.6 `admin.json`: "Administración de capas", "coinciden" instead of "calzan", "completar" instead of "llenar", "el equipo de operaciones", retry messages, and the usage labels without "deforestación"
- [x] 1.7 `flow.json`, `methodology.json`, `manualFarm.json`: review and fix anything against the criteria (field labels that mirror the template headers stay)

## 2. English locales and key rename

- [x] 2.1 Mirror the generic rewording in `en`: country-change warning, "same data" modal, satellite disclaimer, maps details title, usage labels
- [x] 2.2 Rename `common:snackbarAlerts.dataAnalizedSuccessfully` to `dataAnalyzedSuccessfully` in both locales and both call sites, with the English text "Data analyzed successfully"
- [x] 2.3 Add the new keys (`common:contentTabs`, `polygonValidation:export.*`) in both locales

## 3. Methodology Markdown

- [x] 3.1 `content/documentation/es/*.md`: "naranja", "pequeña", and generic wording where "deforestación" means the result of a layer (validation, area, calculation); worked examples on a deforestation layer stay
- [x] 3.2 `content/documentation/en/*.md`: the same generic rewording

## 4. Text outside i18n and literal keys

- [x] 4.1 `DevEnvWarning` reads `common:devWarning`, the comment in `FlowLayout.tsx` follows, and `src/locales/usedKeys.test.ts` checks every literal key against its namespace (it fails with the old key)
- [x] 4.2 `BaseModal`, `BasePolygonModal` and `ClassicTabs` take their accessible labels from i18next, and the close button of `MapsDetailsModal`, which had none, gets `common:close` (covered by `BaseModal.test.tsx`)
- [x] 4.3 `utils/resultsExport.ts` names the validation sheets with the new keys; test the English sheet names

## 5. Verification

- [x] 5.1 Search the tests for every changed string and update them to the new text; translation parity test green
- [x] 5.2 Check that every rewritten key keeps its `{{…}}` names and that no `AS_TEXT` was removed
- [x] 5.3 Browser walk-through in Spanish, desktop and 390 px: landing, stages 1–3, report preview, admin (login, layers, editor, categories, usage)
- [x] 5.4 Local checks for `apps/web` (D20): schema check, `tsc --noEmit`, lint, tests, build
