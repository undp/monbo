## Why

The client's feedback on the redesign (2026-11) asked the start page to stress that Monbo is free and open, to show the three steps without scrolling, to drop the "maps available" wording and to bring in forest imagery and greens. Today the start is split in two pages: `/` asks for the country with large cards and `/home` shows three module cards, so a first-time visitor never sees the whole tool on one screen. The Inicio screen of mockup v2 (2026-11-16) is the agreed target. This is unit GC-9 of the "Gestor de capas" orchestration (undp/monbo#116, sub-issue #125).

## What Changes

- **BREAKING (route):** a single start page at `/[locale]`. `/[locale]/home` stops rendering the module cards and redirects to the start page. Every in-app redirect that used to send the user to `/home` (empty data, restart after a country change) goes to `/`.
- New header navigation, on the light and the dark header, as in mockup v2: the Monbo logo followed by the PNUD/UNDP mark, and the links "Inicio", "Análisis" and "Metodología". The "Metodología" link replaces the documentation icon button. The language menu stays. The admin pages keep their own sections.
- Dark header variant, only on the start page: transparent over the hero, white logo, no country selector. Every other page keeps the light header with the country selector.
- Hero with three badges ("Gratis y de libre acceso", "Sin registro", "No guardamos tus polígonos"), the eyebrow "Monbo · Producción sostenible", the title "Revisa tu producción en 3 pasos." and a lead with an inline "Cómo funciona ↗" link to the methodology page. The photo is the mockup's AI-generated aerial image of a river, forest and farm plots, renamed to describe its content.
- Headings of the start page and the header use the mockup's font, Plus Jakarta Sans, loaded with `next/font` at build time and exposed as the CSS variable `--font-heading` for other units (GC-10) to reuse.
- "Así funciona" band with the subtitle "Empieza por el paso 1. Si ya tienes tus polígonos validados, puedes ir directo al 2." and three step cards:
  1. opens stage 1 (polygon validation) and offers "Descargar plantilla";
  2. opens stage 2 (deforestation analysis today, "Análisis territorial" after GC-10), shows the three generic category chips and links "Ver capas por país";
  3. is not pressable and links "Ver ejemplo de reporte", which opens a sample PDF report (one per language) built from the example farms in `public/files/examples/`.
- Under the steps, a start bar: "¿Dónde produces?" with one pill per country from `GET /countries` (name and bundled silhouette), the "Empezar en {país}" button and the "¿Tu país no está? Escríbenos" link (only when `NEXT_PUBLIC_CONTACT_URL` is set).
- Under the start bar, a trust row: "Desarrollado por el PNUD", "Capas globales y oficiales de cada país", "Disponible en español e inglés".
- Changing the country updates only the pills and the button: the step cards neither re-render nor replay their entrance animation.
- The hero, the three steps and the start button fit without scrolling in a 1366×768 screen. The page is responsive down to phone widths.
- The country cards (`CountryCard`, `InviteCard`) and the `/home` module cards (`components/page/home/*`) are removed. The "same data" modals they opened are kept and move to the start page.
- New i18n keys in `home` (`es` and `en`), replacing the old landing and module card keys.

## Capabilities

### New Capabilities

- `landing-page`: the start page's content and behaviour: dark header variant, hero and badges, the three step cards and what each one opens, the start bar, the no-scroll layout at 1366×768, the mobile layout, and the rule that changing the country does not re-render the steps.
- `site-navigation`: the header's brand (Monbo logo and PNUD/UNDP mark) and its navigation links "Inicio", "Análisis" and "Metodología", on every page, in the light and the dark variant.

### Modified Capabilities

- `country-selection`: `/home` no longer serves module cards and redirects to `/`; the country is chosen with pills in the start bar instead of cards; the request-a-country card becomes a link; the header selector is hidden on the start page; the restart after a country change goes to `/`.
- `methodology-documentation`: the header's documentation icon button becomes the "Metodología" link of the new header navigation.

## Impact

- `apps/web/src/app/[locale]/page.tsx`; `apps/web/src/app/[locale]/home/` is deleted and `apps/web/src/proxy.tsx` redirects `/home`.
- `apps/web/src/components/page/landing/` (rewritten), `apps/web/src/components/page/home/` (removed).
- `apps/web/src/components/reusable/Header/` (new navigation and brand mark, dark variant, `DocumentationButton` replaced), `CountryMenu.tsx` (hidden on the start page), `apps/web/src/app/[locale]/layout.tsx` (header spacer, `--font-heading`).
- `apps/web/src/hooks/useCountryChange.ts`, `NavigateHomepageWhenEmptyData.tsx`, `ValidFarmsTable.tsx` (`/home` → `/`).
- `apps/web/src/config/theme.ts` (`palette.landing` tokens from mockup v2), `apps/web/public/images/` (hero image, white logo), `apps/web/public/files/examples/{es,en}/` (sample report PDFs).
- `apps/web/src/locales/{es,en}/home.json` and `common.json` (header navigation).
- `docs/onboarding.md` (the flow no longer goes through `/home`).
- No API, contract, infra or `NEXT_PUBLIC_*` change. No new runtime request to third parties: silhouettes come from the existing `utils/countryShapes.json`.
- Conflicts:
  - GC-10 (`feat/progressive-flow-stages`, #126) also edits the header. Agreed split, approved by the user: GC-10 only removes the old module buttons ("Validación / Análisis de deforestación / Reporte") from the header on every page; GC-9 adds the new navigation (Inicio, Análisis, Metodología), the PNUD mark and the dark variant, on the light and the dark header. Both touch `Header/index.tsx` and `HeaderBar`; whoever merges second rebases. GC-10 reuses `--font-heading` as defined here.
  - GC-7 changes the report cover, so it regenerates the sample report PDFs added here.
  - GC-13 renames `/deforestation-analysis` later; this change does not touch that route.
