## Why

The client asked for Spanish copy that works in Colombia and Ecuador, and the team chose neutral Spanish with `tú` (D6 of the "Gestor de capas" orchestration, undp/monbo#116). The web copy was written over two years by several people: it still has Chilean words ("mantenedor", "calzar", "naranjo", "chica"), anglicisms ("Click", "Feedback"), and texts that call stage 2 "análisis de deforestación" although Monbo now crosses polygons with layers of several categories. GC-1 to GC-10 and GC-12 are merged into `feat/layer-manager`, so every locale key the feature adds already exists and can be reviewed in one pass. This is unit GC-11 (sub-issue #127).

## What Changes

- Review every Spanish text the user sees: the nine `locales/es/*.json` namespaces and the methodology Markdown in `content/documentation/es/`. The texts use `tú`, no `usted`, no voseo and no regional words, in short sentences with an active voice.
- Texts that are generic say "análisis territorial", "capa" or "categoría" instead of "deforestación". "Deforestación" stays where it names the default category, a deforestation layer or a forest-loss example.
- The same generic rewording in `locales/en/*.json` and `content/documentation/en/` where the English still ties a generic text to deforestation, and the old spelling "Data analized successfully" becomes "Data analyzed successfully".
- The key `common:snackbarAlerts.dataAnalizedSuccessfully` is renamed to `dataAnalyzedSuccessfully` in both locales and its two call sites. The other old-spelling follow-ups (`polygonValidation:analize`, the " Def." suffix) were already removed by GC-10 (#133) and GC-6 (#140).
- Visible text written in components goes through i18next: the "close" and "Content tabs" accessible labels and the validation export's sheet names ("Polígonos válidos", "Polígonos inconsistentes"). The close button of the layer details modal, which had no accessible label, gets "Cerrar" / "Close".
- The testing-environment warning reads `home:devWarning`, a key GC-9 removed from `home`. It only shows its text because `common`, the fallback namespace, has the same key. It now reads `common:devWarning`, and a new test checks that every literal `t("namespace:key")` in the code names a key that exists in that namespace, in both locales.
- No namespace, locale file, key path (apart from the rename above) or route is renamed: GC-13 renames `deforestationAnalysis` and the routes after this unit merges.

## Capabilities

### New Capabilities

- `interface-copy`: the rules every user-facing text of the web follows: neutral Spanish with `tú`, generic wording outside deforestation-specific contexts, every visible string (accessible labels and export sheet names included) through i18next with keys in `es` and `en`, and every literal key the code reads exists in the namespace it names.

### Modified Capabilities

None. The texts change, but no behaviour that an existing spec states changes. The validation export keeps the bilingual header row "Porcentaje de Traslape"/"Overlap Percentage" that `results-export` pins.

## Impact

- `apps/web/src/locales/{es,en}/*.json` (content only, plus the one key rename).
- `apps/web/src/content/documentation/{es,en}/*.md` (content only).
- `apps/web/src/components/reusable/DevEnvWarning.tsx`, `BaseModal.tsx`, `ClassicTabs.tsx`, `components/page/polygonsValidation/BasePolygonModal.tsx`, `components/page/deforestationAnalysis/MapsDetailsModal.tsx`, `utils/resultsExport.ts`, and the two call sites of the renamed key.
- Tests that pin a changed Spanish or English string, and a new `src/locales/usedKeys.test.ts`.
- Out of scope: the upload templates in `public/files/` (their headers are parsed), the layer metadata in `apps/api/app/maps/metadata/` (layer content), the category names and result labels that come from the API, the validation export's bilingual header rows, and renaming namespaces, files or routes (GC-13). No API, contract or environment change.
