## 1. Stage derivation

- [x] 1.1 Add `apps/web/src/utils/flowStages.ts` with `stageFromPathname`, `deriveFlowStages` (states, label keys and bar progress) and `stageHref`
- [x] 1.2 Add `utils/flowStages.test.ts`: routes with and without locale, normal entry, validation done, direct entry to stage 2, analysis done, back to stage 1 after the analysis, outdated analysis, stage 3 locked, the hrefs
- [x] 1.3 Add `hooks/useFlowStages.ts` (pathname + `DataContext`, with `analysisOutdated` excluding results) and a test that renders it with `renderWithData`

## 2. Translations and assets

- [x] 2.1 Add `locales/es/flow.json` and `locales/en/flow.json` (header meta, free note, stage names, states, "Etapa N de 3", next-stage cards, "Continuar", stepper aria label) and register `flow` in `utils/i18n.ts`
- [x] 2.2 Copy the mockup's `img/forest.jpg` to `apps/web/public/images/aerial-river-rainforest.jpg`

## 2b. Application header

- [x] 2b.1 Remove the three module `HeaderButton`s (validation, analysis, report) from `Header/index.tsx`, keeping "Home", the country, documentation and language menus, and drop the unused `home:header:validation|deforestation|report` keys in `es` and `en`
- [x] 2b.2 Update any header test that expected those buttons

## 3. Flow header and stepper

- [x] 3.1 Add `components/page/flow/FlowStepper.tsx`: nav/ol, the dot states (check, dashed, current ring), bars, staggered `rise`/`fill` keyframes, reduced motion, one column below `md`, locked stage 3 not a control, stage 3 opening `MapSelectionModal` when no report layer is chosen
- [x] 3.2 Add `components/page/flow/FlowHeader.tsx` (titles in `var(--font-heading, var(--font-roboto))`): forest gradient, "Análisis en {país} · Cambiar país" (to the landing), free-use note, `DevEnvWarning`, the stepper
- [x] 3.3 Add `components/page/flow/FlowLayout.tsx` (server: `flow` namespace + `TranslationsProvider`) and render it from the three stage `layout.tsx`, inside `RequireCountry`
- [x] 3.4 Add `components/page/flow/FlowHeader.test.tsx` (header and stepper): labels per state, `aria-current`, locked stage 3 not a button, click navigation (mocked router), stage 3 opening the modal

## 4. Next-stage card

- [x] 4.1 Add `components/page/flow/NextStageCard.tsx` (number, eyebrow "Siguiente etapa", title, description, "Continuar")
- [x] 4.2 Turn `polygonsValidation/PageFooter.tsx` into the stage 1 card opening `DeforestationModal`, without the fixed `Footer`
- [x] 4.3 Turn `deforestationAnalysis/PageFooter.tsx` into the stage 2 card opening `MapSelectionModal`, without the fixed `Footer`
- [x] 4.4 Test both cards (`NextStageCards.test.tsx`): they render and "Continuar" opens the modal

## 5. Stage page layouts

- [x] 5.1 Add the "Etapa N de 3" eyebrow to the stage page titles (both upload pages via `UploadPageContent`, the validation, analysis and report titles)
- [x] 5.2 Make the validation and analysis results pages scroll: a bounded table section height, the card below; leave the stage 2 content untouched
- [x] 5.3 Adjust the report and preview pages' heights to the flow header, keeping their footers
- [x] 5.4 Move `DevEnvWarning` out of `UploadPageContent` (the flow header shows it)

## 6. Stage 1 without digits

- [x] 6.1 Add an optional `icon` to `TextHeaderStepContainer` and pass an upload icon from the stage 1 upload page
- [x] 6.2 Give `FarmsUploadStep`'s list title an icon, and render `OptionCard`'s steps with chevrons instead of digits
- [x] 6.3 Update the tests that assert on those elements, if any

## 7. Checks and docs

- [x] 7.1 Run the web CI checks: schema check, `pnpm exec tsc --noEmit`, `pnpm run lint`, `pnpm test`, `pnpm run build`
- [x] 7.2 Update `docs/onboarding.md` if it describes the module-to-module flow (modal, footers)
- [x] 7.3 Verify in the browser: normal entry, direct entry to stage 2, stage 3 without results, narrow viewport, and capture screenshots for the PR

## 8. Review fixes (PR #133)

- [x] 8.1 Stage 2 after a validation and before an analysis opens `DeforestationModal` (`stageAction` in `utils/flowStages.ts`), with tests in `flowStages.test.ts` and `FlowHeader.test.tsx`
- [x] 8.2 A new upload on the stage 2 upload page drops the earlier validation results, with a regression test
- [x] 8.3 Stage 3 opens the report only when its layers are all in the current analysis and it has farms; otherwise the report layer modal
- [x] 8.4 The report preview leaves room for the flow header and the fixed footer
- [x] 8.5 "Análisis en {país}" built with `<Trans>` and `{{country}}`
- [x] 8.6 Spec: the stage 2 modal, the new-upload rule, the stage 3 conditions, and the phone-width scenario limited to the flow header

## 9. Re-review fixes (PR #133)

- [x] 9.1 `stageAction` takes the current stage: the current stage returns `none`, opens no dialog and isn't rendered as a control
- [x] 9.2 The report layer modal closes when "Continue" is pressed
- [x] 9.3 Tests for stage 2 pressed on stage 2 and stage 3 pressed on the report (`flowStages.test.ts`, `FlowHeader.test.tsx`)
- [x] 9.4 Spec notes the browser back-button path as known and left to GC-6; pending item posted on undp/monbo#116
