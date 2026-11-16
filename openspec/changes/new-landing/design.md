## Context

- `/[locale]` renders `LandingPageContent`: a title, large square `CountryCard`s with silhouettes from `utils/countryShapes.json`, an `InviteCard` and a "Continuar con {país}" button that goes to `/home`.
- `/[locale]/home` renders three `ModuleCard`s (`components/page/home/*`) behind `RequireCountry`. Cards 1 and 2 open a "same data" modal when farms are loaded; card 3 is disabled.
- The header (`components/reusable/Header/index.tsx`) is a server component: a fixed white `AppBar`, logo, module buttons (hidden on `/` and `/home`), `CountryMenu`, documentation and language buttons. `app/[locale]/layout.tsx` puts a `<Toolbar />` spacer above every page.
- Country changes all go through `hooks/useCountryChange.ts`; countries come from `useAvailableCountries()` (`GET /countries`, polled and refetched on focus).
- Reference design: the `vInicio` view of mockup v2 (2026-11-16). Its sources (`mockup-source.html`, `img/`, `country-silhouettes.json`) are outside the repo.
- GC-10 (`feat/progressive-flow-stages`, in parallel) redesigns the flow header and layout of the module pages. GC-13 renames routes later.

## Goals / Non-Goals

**Goals:**

- One start page that matches mockup v2's Inicio view and fits a 1366×768 screen.
- Keep every existing rule of country selection (only countries with layers, default CO, lock after an analysis, keyboard use).
- Touch the shared header as little as possible, so GC-10 can restyle the flow header without conflicts.

**Non-Goals:**

- The flow stepper and flow header (GC-10), the methodology content (GC-8), the report content (GC-7), neutral-Spanish rewording of other screens (GC-11), route renames (GC-13).
- Removing the old module buttons from the header: GC-10 does it (see decision 3).
- Any API, contract or environment-variable change.

## Decisions

### 1. Page structure

`app/[locale]/page.tsx` keeps loading the `common` and `home` namespaces and renders a rewritten `LandingPageContent` made of three components in `components/page/landing/`:

- `LandingHero`: background (gradient + photo layer), badges, title, lead with "Cómo funciona ↗". Static.
- `LandingSteps`: "Así funciona" heading and the three `StepCard`s with arrows. `React.memo`, no props that depend on the country.
- `LandingStart`: the start bar (pills, contact link, "Empezar en {país}"), the only part that reads `selectedCountry`.

`LandingPageContent` owns the stage-entry logic (see 4) and the restart modal, and passes **stable** callbacks (`useCallback` over refs) to `LandingSteps`, so a country change re-renders `LandingStart` only.

*Alternative:* one component as today. Rejected: any `DataContext` change would re-render the cards, and the requirement says they must not.

### 2. /home becomes an HTTP redirect in the proxy

`src/proxy.tsx` redirects `/home` → `/` and `/{locale}/home` → `/{locale}` (307) before handing the request to `next-i18n-router`, which then applies the locale cookie as for any other path. The `app/[locale]/home/` route (page and its `RequireCountry` layout) is deleted, so the redirect does not wait for a country. In-app pushes to `/home` (`useCountryChange.confirmRestart`, `NavigateHomepageWhenEmptyData`, `ValidFarmsTable`) change to `/`. `HeaderButton` keeps treating both paths as the homepage.

*Alternatives tried and dropped:*
- A page that calls `redirect()`. It works in `next dev`, but the page is prerendered: in the production build `/en/home` answered 200 (the redirect only ran on the client) and `/home` answered `307 location: /home`.
- `redirects()` in `next.config.ts`. It works with `next start`, but in the standalone server (`node server.js`, what the container runs) having config routes sends the proxy's `/` → `/es` rewrite back through the proxy, so every unprefixed Spanish path (`/`, `/documentation`, …) loops on 307. Found in review.

The proxy redirect is checked by `src/proxy.test.ts` (behaviour: status and location, rewrites left alone) and with `curl -L` against the standalone build (`HOSTNAME=0.0.0.0 node server.js`), with and without the `NEXT_LOCALE=en` cookie.

### 3. Header: new navigation, and a start-page variant

**Split with GC-10 (approved by the user on 2026-11-16).** GC-10 only removes the old module buttons ("Validación / Análisis de deforestación / Reporte") from the header on every page. GC-9 adds the new navigation, the PNUD mark and the dark variant, on the light and the dark header. Both touch `Header/index.tsx` and `HeaderBar`; whoever merges second rebases and keeps both changes.

**Navigation.** `Header/index.tsx` renders the brand (`HeaderBrand`: logo link to `/`, separator, PNUD/UNDP mark as styled text with the mockup's blue, localized through `common:header:brandMark`) and a new `MainNavigation` client component with three links: "Inicio" (`/`), "Análisis" and "Metodología" (`/documentation`). `MainNavigation` goes inside `HeaderNavigation`, so the admin pages keep showing their own sections instead; "Metodología" is rendered outside it, so it shows on the admin pages too. `DocumentationButton` is deleted: "Metodología" replaces it. "Análisis" resumes the flow: `/deforestation-analysis` when an analysis result exists, `/polygons-validation` when validation results exist, else `/polygons-validation/upload-data`; it is active on any page under the three module routes. Below 900 px the three links collapse into a menu button (MUI `Menu`). The old `HeaderButton`s stay in the tree until GC-10 removes them; on the start page they are already hidden.

**Start-page variant.** A hook `hooks/useIsStartPage.ts` (pathname is `/` or `/{locale}`) drives three small client pieces:

- `Header/HeaderBar.tsx` wraps the `AppBar`: on the start page it is `position: absolute`, transparent, without shadow, with a faint bottom border, text white, and the brand swaps `Logo.svg` for `Logo-white.svg`. Elsewhere it keeps today's white bar, with the mockup's bottom border.
- `CountryMenu` returns `null` on the start page.
- `HeaderSpacer` replaces the `<Toolbar />` in `app/[locale]/layout.tsx` and renders nothing on the start page, so the hero starts under the transparent header.

The navigation links and `LanguageMenu` take their color from the bar (`color: inherit`).

*Alternative:* a separate header rendered by the start page. Rejected: the header lives in the root layout, and two headers would fight over the fixed slot.

### 4. What each action opens

- Step card 1 and "Empezar en {país}": stage 1 through `useModuleRouter("/polygons-validation")` (→ `/upload-data` without farms). With farms loaded, the existing "same data" modal (texts `home:sameDataModal:*`) opens first.
- Step card 2: stage 2 through `useModuleRouter("/deforestation-analysis")`, with its "same data" modal. The route stays `/deforestation-analysis` (GC-13 renames it).
- Step card 3: a plain `article`, not focusable, with only the "Ver ejemplo de reporte" link active. The link opens `/files/examples/{es,en}/` sample report PDFs (`ejemplo-reporte.pdf`, `example-report.pdf`) in a new tab. They are generated once with the app itself: load the example farms (`ejemplo-fincas-con-coordenadas.xlsx` / `example-farms-with-coordinates.xlsx`) for Costa Rica, where they are, run the analysis with every layer (GFW, TMF, MOCUPP) and download the PDF report. They are generated **without the satellite background** (API without the Maps key, web with a satellite limit below 5 farms): Google Maps imagery can't be kept in a public repository as a static file. Each PDF has 24 pages and about 500 KB. The steps are written in `public/files/examples/README.md` so GC-7 can regenerate them after it changes the cover.
- "Descargar plantilla": `<a download href={getUploadFileTemplatePath(locale)}>` (the main Excel template).
- "Cómo funciona ↗": `/documentation`. "Ver capas por país ↗": `/documentation#deforestation` until GC-8 adds the per-country layers section and retargets it.
- "¿Tu país no está? Escríbenos": `CONTACT_URL`, hidden when unset (same rule as the old invite card).

The pressable cards use the "stretched link" pattern: the title is a `<button>` whose `::after` covers the card, and the secondary links sit above it with their own focus. No interactive element is nested inside another.

The two modal flows move from `PolygonValidationModuleCard`/`DeforestationModuleCard` into one hook, `hooks/useStageEntry.ts`, that returns `open()` and the modal props for a stage. `components/page/home/` is deleted.

### 5. Country pills

`LandingStart` renders a `role="group"` (labelled by "¿Dónde produces?") of `CountryPill` toggle buttons (`aria-pressed`, as the old cards), so Tab and Enter work without a roving-focus pattern,, selected through `requestCountryChange` (lock and restart modal unchanged). The default-country effect (CO, else the first) moves here unchanged. Silhouettes reuse `utils/countryShapes.json` (174 countries, 100×100 box, generated from world-atlas, public domain) through a small `utils/countryShape.ts` (`getCountryShape(code)`), which also serves any new country from `GET /countries`. The mockup's `country-silhouettes.json` (only CO, EC, CR) is not imported.

### 6. Visual tokens and assets

- `palette.landing` in `config/theme.ts` is replaced by mockup v2's tokens (navy `#0a2440`, forest `#0e3b30`, leaf `#2f8f5e`, leaf-light `#5cc08a`, mint `#eef7f1`, ink `#0b2545`, muted `#6b8299`, line `#e2ecf5`, blue `#0d64a0`). Only the start page reads it.
- Category chips use fixed colors and MUI icons (tree / shield / sprout). They are illustrative and generic; GC-6 owns per-country categories.
- Icons come from `@mui/icons-material` (already a dependency), not the mockup's inline SVGs.
- Hero image: the mockup's `img/hero.jpg`, which the user confirmed is AI-generated, so there is no third-party licence to track. It is stored as `public/images/landing/aerial-forest-river-farm-plots.webp`, resized to 1280×640 and encoded as WebP (≈160 KB; the JPEG stayed near 300 KB), and drawn as a decorative CSS background behind the gradient mask (no `alt`, nothing for screen readers). The mockup's "Imagen referencial" note is not shipped.
- White logo: `public/images/Logo-white.svg`, generated from `Logo.svg` by turning the dark wordmark fills white and keeping the gradient leaf, as the mockup's `logo_white.png` does.
- Heading font: Plus Jakarta Sans (700 and 800) loaded with `next/font/google` in `app/[locale]/layout.tsx`, next to Roboto, and exposed on `<body>` as the CSS variable **`--font-heading`** (name agreed with GC-10, which reuses it). `next/font` downloads the files at build time and serves them from the app, so there is no request to Google at run time. The start page's headings and the header brand use it; the MUI theme's typography stays on Roboto, so other pages do not change.

### 7. Fitting 1366×768

The vertical budget follows the mockup: header 64 px over the hero, hero ≈ 300 px, steps overlapping the hero by ≈ 88 px, cards ≈ 190 px, start bar ≈ 70 px; total ≈ 620 px. That leaves room for a 1366×768 viewport and also for the ≈ 657 px a 1366×768 laptop shows inside Chrome with a taskbar, which is the realistic case. The dev-environment warning moves inside the hero (top right, absolute) so it adds no height. Verified with a browser screenshot at 1366×768 and 1366×657; jsdom cannot measure layout.

### 8. Motion

Step cards and arrows rise once on mount with a CSS keyframe and staggered delays, disabled under `prefers-reduced-motion: reduce`. Since the cards keep their DOM nodes (decision 1), changing the country never replays it.

### 9. Tests (Vitest, next to the code)

- `LandingStart`: pills from the mocked country list, default CO, selection by click and keyboard, button label, contact link hidden without `CONTACT_URL`, loading/error/empty states.
- `LandingPageContent`: changing the country does not re-render `LandingSteps` (`React.Profiler` commit count) and keeps the same card DOM nodes; card 1 and 2 navigation with and without farms; card 3 is not a button; template link per locale.
- `home/page`: `redirect` is called with `/` for `es` and `/en` for `en`.
- `useIsStartPage`, `CountryMenu` hidden on the start page, `useCountryChange` restart goes to `/`.

## Risks / Trade-offs

- [GC-10 edits the same header files] → the change is confined to `HeaderBar`, `HeaderSpacer` and one guard in `CountryMenu`; the light header keeps today's markup. Whoever merges second rebases; the orchestration records it.
- [The hero image is AI-generated] → it is decorative and shows no real farm or data; replacing it is one file.
- [Real 1366×768 screens show less than 768 px] → the layout targets 657 px, checked by screenshot.
- [Bookmarks to `/home`] → the redirect keeps them working; it can be removed after GC-13.
- [The sample report shows today's report while GC-7 changes the cover] → the PDFs are static files with written regeneration steps; GC-7 refreshes them (noted on the orchestration).
- [Header conflicts with GC-10] → split agreed above; the second PR to merge rebases.

## Migration Plan

Web-only, train 1. Merge to `dev` deploys `dev`; production gets it with the next release to `main`. Rollback is reverting the PR: no data, contract or environment change.

## Open Questions

None. Puerta 1 answers (2026-11-16, user): keep the mockup's AI-generated hero image under a descriptive name; "Ver ejemplo de reporte" opens a sample PDF per language; include the eyebrow, the trust row, the header links and the PNUD mark, with "Metodología" replacing the documentation button; add Plus Jakarta Sans as `--font-heading`.
