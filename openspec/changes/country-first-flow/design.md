## Context

Today the country is chosen in `useCountryAndMapsSelection`. It is a multi-select stored in `localStorage` (`deforestationAnalysis.selectedCountries`), and two places render it: `DeforestationModal` (polygon validation) and `DeforestationAnalysisUploadDataPageContent` (direct deforestation flow). The countries offered are the union of `availableCountriesCodes` of the layers returned by `GET /maps`. At the time of writing that is EC, CO and CR, but admins can create layers for any ISO code, so the set is dynamic.

The loaded data (`farmsData`, `polygonsValidationResults`, `deforestationAnalysisResults`, report params) lives only in memory in `DataContext` and is lost on reload. Each farm has a `country` that comes from a mandatory Excel column. The report cover, the report table and the Excel download use it.

The existing Google Maps component (`components/reusable/Map.tsx`) is built to draw farm polygons over satellite or road tiles, with `mapId="test"`.

A follow-up change (`per-country-layers`) will give each country its own layers and admin and add `GET /countries`. This change must work with the current API and not block that one.

## Goals / Non-Goals

**Goals:**
- The country is the first choice and applies to the whole analysis.
- Only countries with layers can be selected, derived at runtime from the layers the API returns.
- After an analysis, the country can't change without an explicit restart.
- The upload template no longer asks for the country.
- No API change.

**Non-Goals:**
- Analyzing farms of several countries together. Before this change it was possible with global layers (GFW, TMF); after it, one analysis is one country.
- Warning about or filtering farms whose location falls outside the selected country.
- Changing how layers are stored or administered (`per-country-layers`).
- Putting the country in the URL.

## Decisions

### D1. Routes: `/` is the landing, `/home` holds the module cards

The landing replaces `src/app/[locale]/page.tsx`, and the current page moves to `src/app/[locale]/home/page.tsx` unchanged.

Every internal link to `/` that means "home" is repointed to `/home`: `HeaderButton path="/"`, the header logo, `useModuleRouter` (special case for `/`), `NavigateHomepageWhenEmptyData`, and the `router.push("/")` in `ValidFarmsTable`. `HeaderButton` hides the module buttons on `/home` as it does today on `/`, and also on the landing.

*Alternatives:*
- Serving the landing or the cards from `/` depending on state: one URL for two screens, harder to link and test.
- Putting the country in the URL (`/[locale]/[country]/...`): a rewrite of every route for three countries.

### D2. `selectedCountry` lives in `DataContext`, persisted in `sessionStorage`

`DataContext` gains `selectedCountry: string | null` (ISO alpha-2) and a setter, persisted under `monbo.selectedCountry` in `sessionStorage`.

- **Not `localStorage`:** farms don't survive a reload, so a country remembered forever would silently skip the landing for returning users.
- **Not memory only:** a reload in the middle of the flow would drop the user back on the landing even when nothing depended on the data yet.

On load, the old `localStorage` key `deforestationAnalysis.selectedCountries` is removed.

The value read from storage is valid only if it belongs to the countries with layers. If it doesn't once the layer list arrives, it is cleared. `DataContext` exposes `countryHydrated` so guards don't redirect before `sessionStorage` has been read, which would cause a redirect flash on reload.

### D3. Available countries come from the layers already fetched

`availableCountries = uniq(availableMaps.flatMap(m => m.availableCountriesCodes))`. That is the same computation `countriesOptions` does today, lifted into a small hook (`useAvailableCountries`) that the landing, the header menu and the guard share. `per-country-layers` will replace its body with a call to `GET /countries` without touching the consumers.

While `availableMaps` is still loading (first fetch), the landing shows the map with nothing selectable and a loading state, not an empty map.

### D4. One path for every country change: `requestCountryChange(code)`

A single function, shared by the landing and the header menu, applies the rules:

```
requestCountryChange(code)
  ├─ code == selectedCountry          → no-op (landing: navigate to /home)
  ├─ no deforestationAnalysisResults  → set country; clear deforestationAnalysisParams.selectedMaps
  │                                      and reportGenerationParams.selectedMaps; keep farms and
  │                                      validation results. Landing: navigate to /home.
  └─ deforestationAnalysisResults     → open RestartAnalysisModal
                                          ├─ Cancel → nothing changes
                                          └─ Accept → resetAnalysis(); set country; push /home
```

The lock depends only on state (`deforestationAnalysisResults != null`), not on the current page. After an analysis, going back to the validation tab keeps the selector locked. In the direct deforestation flow, the country can still change before the analysis runs.

`resetAnalysis()` sets `farmsData`, `polygonsValidationResults` and `deforestationAnalysisResults` to `null` and resets `deforestationAnalysisParams` and `reportGenerationParams` to their initial values. The "new data" modals of `PolygonValidationModuleCard` and `DeforestationModuleCard` already do this inline; they switch to the shared action.

The landing is reachable after an analysis (typed URL, back button). Picking another country there goes through the same function, so the lock can't be bypassed.

### D5. The map is an SVG rendered with d3-geo, not Google Maps

The landing map is a static SVG:
- `world-atlas` `countries-110m` TopoJSON (~105 KB), loaded lazily so it stays out of the other pages' bundles;
- converted with `topojson-client`;
- projected with `d3-geo` (`geoNaturalEarth1` or `geoMercator`);
- rendered as React `<path>` elements.

Highlighted countries get the primary color, a hover state, a pointer cursor, a `role="button"` with an accessible name, and a tooltip with the translated name. The rest are neutral and inert.

The projection is fitted (`fitExtent`) to the bounding box of the available countries, with padding, and every country is still drawn. The initial view follows whatever countries exist: today it frames northern South America and Central America; if Kenya is added it zooms out.

*Alternatives:*
- **Google Maps with the `COUNTRY` feature layer:** needs a real cloud Map ID with data-driven boundary styling, which is extra GCP configuration and per-load cost.
- **Google Maps with a GeoJSON `Data` layer:** base tiles are visual noise for a selector, and it still needs world geometries.
- **`react-simple-maps`:** its peer dependencies stop at React 18, and this app runs React 19.

`world-atlas` identifies countries by their ISO 3166-1 numeric code (for example `170` for Colombia). `utils/countries.ts` gains a `numericCode` per entry and a `getCountryByNumericCode` helper, so the rest of the app keeps using alpha-2.

Costa Rica is small at 110m and at this zoom. The list next to the map (D6) makes sure it is always easy to pick.

### D6. List of countries next to the map

Next to or under the map, a list of buttons (one per available country, translated name) calls `requestCountryChange`. It gives keyboard and screen-reader access, a clear target for small countries, and a usable page on narrow screens where the map shrinks.

### D7. Header `CountryMenu`

A client component rendered in `Header` before `LanguageMenu`, in the same `Suspense`. It shows the selected country's translated name with a dropdown of the available countries, and every change goes through `requestCountryChange`. When the analysis is locked, the menu still opens, so the user discovers the restart modal instead of a disabled control with no explanation. It is hidden on the landing (the map is the selector there) and when no country is selected.

### D8. The farm's country comes from the selection, not the file

`utils/excel.ts` drops `country` from `mandatoryHeaders`, from the header aliases (so an old `país`/`country` column is ignored like any unknown column), and from the ISO validation. Both upload pages add `country: selectedCountry` to each row before `generateFarmsData`.

`POST /farms/parse` keeps requiring and validating `country`, so the API, its tests and the regression fixtures are unchanged, and `FarmData.country` keeps feeding the report and the download.

The templates `m1-upload-file-template-{en,es}.xlsx` are regenerated without the column, keeping the other columns, their order and their formatting.

### D9. Layer lists use the selected country

`useCountryAndMapsSelection` becomes `useMapsForSelectedCountry`. It returns the options of `availableMaps` whose `availableCountriesCodes` include `selectedCountry`, plus the selected options, and it has no country state of its own. The "no countries selected" message disappears, and "no maps available" stays for a country whose layers were all disabled mid-session. `MapSelectionModal` (report generation) keeps using the layers chosen for the analysis.

### D10. Contact button configured at runtime

`NEXT_PUBLIC_CONTACT_URL` follows the pattern of the other public variables: `config/env.ts` reads it with a `__NEXT_PUBLIC_CONTACT_URL__` placeholder, and `entrypoint.sh` replaces it at container start. It can be an `https:` URL or a `mailto:` link. It opens in a new tab for `https:`. When it is empty or still the placeholder, the button is not rendered. `azure/deploy.sh` passes it to the frontend app.

## Risks / Trade-offs

- **[Multi-country files lose joint analysis]** A file mixing CO and EC farms used to be analyzable in one pass with GFW or TMF. → An accepted product decision. The farms get the selected country regardless of where they are. The docs say one analysis is one country.
- **[Farm `country` may be wrong]** Farms located in EC but uploaded under CO are labeled CO in the report. → Out of scope, noted in the docs. A later change could compare farm centroids with country geometries.
- **[Old templates in circulation]** Users with the previous template keep a `country` column. → The column is ignored, not rejected, so old files keep working.
- **[Redirect flash on reload]** A guard reading `selectedCountry` before `sessionStorage` is hydrated would bounce to the landing. → Guards wait for `countryHydrated` (D2).
- **[Stored country no longer available]** An admin disables the last layer of a country between sessions. → The stored value is cleared when it isn't in the available set, and the user lands on the map (D2). Mid-session, the layer list shows "no maps available".
- **[Small countries at 110m]** → The list fallback (D6). Switching to `countries-50m` (~750 KB) was rejected for the bundle cost.
- **[Route change breaks bookmarks]** Bookmarks of `/` now land on the map instead of the cards. → Acceptable: without a selected country, the cards page would redirect to the map anyway.

## Migration Plan

This is a frontend-only release. Deploy the frontend with `NEXT_PUBLIC_CONTACT_URL` set, and publish the new templates with the same deploy. Rolling back means redeploying the previous frontend image; no data or API state is involved.
