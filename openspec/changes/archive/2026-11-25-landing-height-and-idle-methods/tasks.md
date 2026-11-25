## 1. Start page

- [x] 1.1 `LandingPageContent`: a column at least `100svh` tall; the steps' wrapper full width
- [x] 1.2 `LandingHero`: `flex: 1 0 auto`, content centered; on a screen ≥1440×860 the title at 56 px, the lead at 20 px and "3 pasos" on one line
- [x] 1.3 `LandingTrust`: bottom padding, so it doesn't touch the screen's edge

## 2. Upload methods

- [x] 2.1 `MethodButton`: the muted look for a method not picked, and the usual colors on hover

## 3. Verification

- [x] 3.1 `pnpm exec tsc --noEmit`, `pnpm run lint`, `pnpm test` and `pnpm run build` in `apps/web`
- [x] 3.2 `openspec validate landing-height-and-idle-methods --strict`
- [x] 3.3 Start page at 1366×768 (cards and button without scroll), 1575×900 and 1920×1080 (no blank band)
- [x] 3.4 Upload methods by hand: the picked one stands out, the others look muted and come back on hover, at 1440 px and 390 px
