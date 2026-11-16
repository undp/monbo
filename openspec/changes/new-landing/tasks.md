## 1. Routing

- [x] 1.1 Redirect `/home` and `/{locale}/home` to the start page in `next.config.ts` (`redirects()`) and delete `app/[locale]/home/`
- [x] 1.2 Change in-app pushes to `/home` to `/` (`useCountryChange.confirmRestart`, `NavigateHomepageWhenEmptyData`, `ValidFarmsTable`) and update their tests
- [x] 1.3 Test the redirect rules, and check them with `curl -L` against the production build

## 2. Header: navigation and start-page variant

- [x] 2.1 Add `hooks/useIsStartPage.ts` (pathname `/` or `/{locale}`) with tests
- [x] 2.2 Load Plus Jakarta Sans with `next/font` in `app/[locale]/layout.tsx` as `--font-heading`
- [x] 2.3 Add `public/images/Logo-white.svg` (white wordmark, gradient leaf kept)
- [x] 2.4 Add `Header/HeaderBar.tsx` (transparent, absolute, white on the start page; white bar elsewhere) and `HeaderBrand` (logo, separator, PNUD/UNDP mark)
- [x] 2.5 Add `Header/MainNavigation.tsx` ("Inicio", "Análisis" with the resume rule, "Metodología"; active state; menu button below 900 px) with tests, and delete `DocumentationButton`
- [x] 2.6 Make `LanguageMenu` inherit the bar's color
- [x] 2.7 Hide `CountryMenu` on the start page, with a test
- [x] 2.8 Replace the layout's `<Toolbar />` spacer with `HeaderSpacer`, which renders nothing on the start page
- [x] 2.9 Add the header keys to `common.json` (`es`, `en`): navigation labels and brand mark

## 3. Start page

- [x] 3.1 Replace `palette.landing` in `config/theme.ts` with the mockup v2 tokens
- [x] 3.2 Add the hero image as `public/images/landing/aerial-forest-river-farm-plots.webp` (1280×640, ≤200 KB)
- [x] 3.3 Add `hooks/useStageEntry.ts` with the "same data" modal logic from the module cards, with tests
- [x] 3.4 Build `LandingHero` (badges, eyebrow, title, lead with "Cómo funciona ↗", dev-environment warning inside the hero)
- [x] 3.5 Build `LandingSteps` and `StepCard` (memoized, stretched-link cards, template download, category chips, "Ver capas por país", non-pressable step 3 with "Ver ejemplo de reporte", entrance animation with reduced-motion fallback)
- [x] 3.6 Add `utils/countryShape.ts` and build `LandingStart` with `CountryPill`s (button group with `aria-pressed`, default CO, loading/error/empty states, contact link, "Empezar en {país}")
- [x] 3.7 Rewrite `LandingPageContent` to compose them with stable callbacks and the restart modal
- [x] 3.8 Add the trust row under the start bar (hidden below 900 px)
- [x] 3.9 Generate the sample report PDFs (`public/files/examples/es/ejemplo-reporte.pdf`, `public/files/examples/en/example-report.pdf`) from the example farms, and write the regeneration steps in `public/files/examples/README.md`
- [x] 3.10 Delete `CountryCard`, `InviteCard` and `components/page/home/`
- [x] 3.11 Mobile layout below 900 px (stacked cards, rotated arrows, wrapped start bar, no horizontal scroll)

## 4. Texts

- [x] 4.1 Replace the `home` landing and module-card keys with the new keys in `locales/es/home.json` (neutral Spanish, tú) and `locales/en/home.json`; drop unused keys
- [x] 4.2 Keep translation parity (`locales.test.ts`) green

## 5. Tests

- [x] 5.1 `LandingStart`: pills, default, click and keyboard selection, button label, contact link, loading/error/empty states, restart modal when an analysis exists
- [x] 5.2 `LandingPageContent`: a country change does not re-render the steps and keeps the card DOM nodes; step 1/2 navigation with and without farms; step 3 not pressable; template link per locale

## 6. Docs and verification

- [x] 6.1 Update `docs/onboarding.md` (flow no longer goes through `/home`; start page with pills; header navigation)
- [x] 6.2 Comment on the orchestration (#116) that GC-7 must regenerate the sample report PDFs
- [x] 6.3 Run the web CI checks: schema check, `tsc --noEmit`, `lint`, `test`, `build`
- [x] 6.4 Verify in the browser at 1366×768 and 1366×657 (steps and button without scroll) and at 390×844, and take screenshots for the PR
