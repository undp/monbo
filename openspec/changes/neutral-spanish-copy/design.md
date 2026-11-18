## Context

- The web has 9 namespaces per language (about 630 keys) and 7 methodology Markdown files per language. Spanish is the default locale.
- Most texts already use `tú`. The problems are local words, anglicisms, inconsistent casing, a few long or passive sentences, and texts written when stage 2 was only a deforestation analysis.
- Units GC-5 to GC-10 and GC-12 are merged into `feat/layer-manager`, so every key the feature adds is on the branch. GC-13 renames the `deforestationAnalysis` namespace and the routes after this unit merges.
- Texts that interpolate API or admin data use `AS_TEXT` (`utils/asText.ts`) so names are not HTML-escaped. Rewritten texts keep their interpolation names, and no `AS_TEXT` is removed.
- The mockup v2 texts (2026-11-16) are the reference for wording already agreed with the client.

## Goals / Non-Goals

**Goals:**

- One consistent voice in Spanish: neutral, `tú`, short, active.
- Generic wording ("análisis territorial", "capa", "categoría") where a text no longer depends on deforestation.
- No visible string outside i18next, and no key that resolves only by falling back to `common`.

**Non-Goals:**

- Renaming namespaces, locale files, key paths (except `dataAnalizedSuccessfully`) or routes: GC-13.
- The upload templates in `public/files/`, whose headers are parsed, and the field labels that mirror those headers.
- The validation export's bilingual header rows ("Resultado Validación\nValidation Result", "Porcentaje de Traslape\nOverlap Percentage"), which follow the template's layout and are pinned by `results-export`.
- Layer metadata (`apps/api/app/maps/metadata/`) and the category names and result labels served by the API. Problems found there go to the PR as follow-ups.
- Rewriting English copy for style. English changes only where it is tied to deforestation, has an old spelling, or mirrors a Spanish fix.

## Decisions

### Writing criteria

1. **`tú`, never `usted` or voseo.** Imperatives in `tú`: "Sube", "Elige", "Completa", "Inténtalo".
2. **Neutral vocabulary for Colombia and Ecuador.** Replace regional words with the term both countries share:

   | Now | Becomes | Why |
   |---|---|---|
   | mantenedor | administración | "Mantenedor" for an admin screen is Chilean |
   | calzar, calce | coincidir, ajustarse | Chilean in this sense |
   | naranjo (color) | naranja | "Naranjo" is the tree outside Chile |
   | chica (size) | pequeña | Neutral register |
   | llenar (a form) | completar | "Completar" is understood everywhere; Colombia says "diligenciar" |
   | Click | clic, "Haz clic" | Spanish spelling |
   | Feedback | Mensaje | Anglicism |

3. **Short sentences, active voice, one idea each.** Split comma splices ("Estás en un ambiente de pruebas, los análisis…"). Prefer "No se pudo …" to "Ocurrió un error al …" for errors, followed by what to do when there is something to do.
4. **Sentence case** in titles, buttons and headers ("Guardar cambios", not "Guardar Cambios"), and articles where they read naturally ("Fecha del reporte", "Tipo de cultivo", as in the mockup).
5. **Monbo's own terms stay:** finca, polígono, punto, capa, categoría, hallazgo, observación, umbral, "Sin dato" (N/D), plantilla, debida diligencia, EUDR. "Traslape" stays, and replaces "superposición" on the landing (decided at Puerta 1).

### Generic vs. deforestation-specific

- **Generic** (rewritten): any text about stage 2 as a whole, its results, its map, the usage dashboard labels, the country-change warning, the "same data" modal, the satellite-image disclaimer of the results map, and the methodology paragraphs that use "deforestación" to mean "the result of a layer".
- **Stays "deforestación"**: the default category's name and its result labels (API content, D15), lists of example categories ("Deforestación, Áreas protegidas, Frontera agrícola"), forest-loss examples in the admin (polarity and temporal help, the IDEAM example layer), and the methodology's worked example on a deforestation layer.
- Usage event names (`deforestation-analysis`, D12), key paths with "deforestation" and file names stay: only the visible text changes.

### Key rename

`common:snackbarAlerts.dataAnalizedSuccessfully` → `dataAnalyzedSuccessfully`. It lives in `common`, which GC-13 does not touch, and has two call sites, so renaming it here closes the follow-up without colliding with GC-13. The API contract keeps no `analize` either since GC-12; nothing on the API changes.

### Hardcoded text

- The accessible labels "close" (`BaseModal`, `BasePolygonModal`) use `common:close`, and so does the close button of `MapsDetailsModal`, which had no label (found in the browser walk-through); "Content tabs" (`ClassicTabs`) gets a new `common:contentTabs` key.
- The validation export's sheet names use new keys `polygonValidation:export.validSheet` / `inconsistentSheet`, like the territorial sheet already uses `common:layerResults.sheetName`. No reader of these files looks sheets up by name.
- `DevEnvWarning` reads `common:devWarning`. GC-9 removed `home:devWarning`; the warning still shows its text only because `fallbackNS` is `common` (`utils/i18n.ts`), which has the same key. A page that loaded its namespaces without `common` first would show the raw key.
- `src/locales/usedKeys.test.ts` scans the code for every string literal that starts with a real namespace and a `:` (in a `t()` call, a ternary, a constant or a prop: about 710 uses) and fails when the key is missing from that namespace or names a group of texts instead of a text, in `es` or `en`. Keys built at runtime (template literals, variables) are not covered. On the branch it found `home:devWarning`, and `useStageEntry` kept a group key (`home:sameDataModal:polygonValidation`) to build `:title`/`:description` at runtime; it now holds the two full keys.
- MUI's default English texts: the closable `Alert`s (the snackbars and the manual-farm drawing warning) pass `closeText`, and the usage charts pass `localeText.noData`. `SnackbarProvider` sits in the root layout, above every page's `I18nextProvider`, so the layout translates its close label on the server and passes it as a prop, as the header already loads `common` there. No other MUI component in the app renders a default text (no `Autocomplete`, `Pagination`, `TablePagination` or `Breadcrumbs`).

### Verification

- The translation parity test stays green, and every test that pins a changed string is updated to the new text.
- A walk-through in the browser in Spanish, at desktop width and at 390 px: landing, the three stages, the PDF report preview and the admin (login, layers, layer editor, categories, usage), to catch layout breaks from texts that changed length.

## Risks / Trade-offs

- [A test pins an old string and the suite breaks] → Search the tests for every changed string before running them, and update the assertion to the new text, never the other way round.
- [A rewritten interpolated text loses a variable or its `AS_TEXT`] → Diff the `{{…}}` names of every changed key between before and after; no `t()` call site changes options.
- [A longer text breaks a layout] → Browser walk-through at 390 px; keep rewrites the same length or shorter where the space is tight (buttons, chips, table headers).
- [Wording the client already validated in the mockup gets changed] → Mockup texts are kept as they are, except the landing's "superposiciones", approved at Puerta 1.

## Migration Plan

Content only: ships with the integration PR `feat/layer-manager` → `dev` (D19) and needs no migration. Rollback is reverting the commit.

## Open Questions

Both closed at Puerta 1 by the user on 2026-11-18:

1. **"Traslape" or "superposición":** "traslape" everywhere. The landing's "Revisamos errores y superposiciones" becomes "Revisamos errores y traslapes", so one concept has one word. It is the cadastral term in Colombia and Ecuador, and the export header that `results-export` pins already uses it.
2. **The key rename:** `dataAnalizedSuccessfully` is renamed in this unit.
