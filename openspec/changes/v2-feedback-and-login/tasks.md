## 1. Feedback and waits

- [x] 1.1 `SnackbarContext`: white cards with the type's color on the icon and left edge
- [x] 1.2 `LoadingScreen`: a stage card as wide as a stage's body, a blue spinner, a `status` region
- [x] 1.3 `ZipProgress`: the stage card, heading font and blue ring

## 2. Controls

- [x] 2.1 `DownloadButton`: "Descargar" with icon and arrow, ids from `useId`; `common:download`
- [x] 2.2 `Map.tsx`: named controls on white cards; `common:mapControls`

## 3. Admin login

- [x] 3.1 `AdminLoginPageContent`: stage background and card, lock tile, eyebrow, heading font, v2 field
- [x] 3.2 `FIELD` to `components/reusable/inputs/fieldStyles.ts`

## 4. Cleanup

- [x] 4.1 Delete `Footer`, `NavigationButton` and `SingleSelector`, imported nowhere

## 5. Verification

- [x] 5.1 `pnpm exec tsc --noEmit`, `pnpm run lint`, `pnpm test` and `pnpm run build` in `apps/web`
- [x] 5.2 `openspec validate v2-feedback-and-login --strict`
- [x] 5.3 Screenshots at 1440×900: the admin login (with an error), the loading screen, a snackbar, the download menu, the farm detail's map controls and stage 2's header
- [ ] 5.4 By hand in the browser: the same screens, and the ZIP progress with a large report
