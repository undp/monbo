## ADDED Requirements

### Requirement: /home redirects to the start page

`/[locale]/home` SHALL NOT render a page of its own. It SHALL redirect to the start page of the same language (`/[locale]`), whether or not a country is selected. Every in-app redirect that returns the user to the start of the flow SHALL go to the start page. The header's "Home" button and the header logo SHALL go to the start page.

#### Scenario: Spanish

- **WHEN** the user opens `/es/home`
- **THEN** the browser ends on the Spanish start page (`/es`, served as `/`)

#### Scenario: English

- **WHEN** the user opens `/en/home`
- **THEN** the browser ends on `/en`

#### Scenario: Data cleared on a module page

- **WHEN** the user is on `/polygons-validation` and the loaded farms are cleared
- **THEN** the browser navigates to the start page

### Requirement: Country choice on the start page

The start page SHALL let the user choose the analysis country among the countries with layers, and only those, as pills in its start bar. Each pill SHALL show the country's name, translated to the current language, and its silhouette. Choosing a pill SHALL select that country through the same rules as the header selector, including the restart confirmation once an analysis exists. Exactly one pill SHALL be selected at a time, and the pills SHALL be usable with the keyboard. When the user arrives without a selected country, Colombia SHALL be selected, or the first country if Colombia has no layers. The start bar SHALL show a loading state until the list of countries has been fetched. If fetching the list fails before any list has arrived, it SHALL show an error message asking the user to reload the page. When the list is empty it SHALL say that no country is available yet.

#### Scenario: Current countries

- **WHEN** the layers list the country codes EC, CO, and CR
- **THEN** the start bar shows the Colombia, Costa Rica, and Ecuador pills, and no pill for any other country

#### Scenario: Default and change

- **WHEN** a user in a new tab opens the start page and then chooses the Ecuador pill
- **THEN** Colombia is selected at first, and after the choice the Ecuador pill is highlighted and the button reads "Empezar en Ecuador"

#### Scenario: Keyboard selection

- **WHEN** a keyboard user tabs to the Costa Rica pill and presses Enter
- **THEN** Costa Rica becomes the selected country

#### Scenario: Countries cannot be fetched

- **WHEN** fetching the countries fails while the start page loads
- **THEN** the start bar shows an error message asking to reload the page, and the step cards are still shown

#### Scenario: New country appears without a frontend change

- **WHEN** an admin enables a layer for PE
- **THEN** after the next refresh the start bar shows a Peru pill with Peru's silhouette

#### Scenario: Start page cannot bypass the lock

- **WHEN** an analysis exists for CO and the user picks the Ecuador pill on the start page
- **THEN** the restart modal opens

## MODIFIED Requirements

### Requirement: A single selected country, kept for the browser session

The application SHALL hold exactly one selected country (an ISO 3166-1 alpha-2 code) or none. The selection SHALL survive page reloads within the same browser tab session and SHALL NOT survive closing the tab. A stored country that is not among the countries with layers SHALL be discarded, together with the farms and results loaded for it. The previous multi-country preference stored under the `localStorage` key `deforestationAnalysis.selectedCountries` SHALL be removed.

#### Scenario: Reload keeps the country

- **WHEN** the user selected Ecuador and reloads `/polygons-validation/upload-data`
- **THEN** Ecuador is still the selected country and the start page is not shown

#### Scenario: New tab starts without a country

- **WHEN** the user opens the application in a new tab
- **THEN** no country is selected until the start page preselects Colombia

#### Scenario: Stored country no longer available

- **WHEN** the tab session holds CR and, after a reload, no layer lists CR
- **THEN** the selection is cleared and the user is shown the start page

#### Scenario: Stored country dropped with a flow loaded

- **WHEN** an analysis for EC is loaded, EC loses its last layer, and the user changes the language
- **THEN** the selection and the loaded farms and results are cleared, and the start page starts from an empty flow

### Requirement: Module pages require a selected country

Every page under `/polygons-validation`, `/deforestation-analysis`, and `/report-generation`, including their sub-pages, SHALL redirect to the start page when no country is selected. The redirect SHALL NOT happen before the stored selection has been read. The start page and the admin pages SHALL NOT require a selected country.

#### Scenario: Direct link without a country

- **WHEN** a user in a new tab opens `/polygons-validation/upload-data`
- **THEN** they are redirected to the start page

#### Scenario: Admin unaffected

- **WHEN** a user in a new tab opens `/admin/layers`
- **THEN** the admin page is shown without asking for a country

### Requirement: Country selector in the header

On every page except the start page, the header SHALL show the selected country's name, placed to the left of the language menu, as a control that lists the available countries. The header SHALL NOT show the selector when no country is selected. On the start page the country is chosen in the start bar instead, and the header SHALL NOT show the selector.

#### Scenario: Selector shows the current country

- **WHEN** the selected country is CO, the language is Spanish, and the user is on `/polygons-validation`
- **THEN** the header shows "Colombia" to the left of the language icon

#### Scenario: Follows the start page's pills

- **WHEN** the user chooses the Costa Rica pill on the start page and then opens stage 1
- **THEN** the header shows "Costa Rica"

#### Scenario: Hidden on the start page

- **WHEN** a country is selected and the user is on the start page
- **THEN** the header shows no country selector

### Requirement: Country locked after an analysis, with a restart confirmation

Once a deforestation analysis result exists, choosing a different country SHALL NOT change it directly. It SHALL open a modal explaining that changing the country requires starting a new analysis and uploading the polygons again. The lock SHALL depend only on whether an analysis result exists, not on the current page. The same rule SHALL apply when the choice is made on the start page.

- If the user accepts, the application SHALL clear the farms, the polygon validation results, the analysis results, and the analysis and report parameters, SHALL set the new country, and SHALL navigate to the start page.
- If the user cancels, nothing SHALL change and the user SHALL stay on the same page.

#### Scenario: Accept restart

- **WHEN** an analysis exists for CO, the user picks Costa Rica in the header, and accepts the modal
- **THEN** all loaded data is cleared, the selected country is CR, and the browser shows the start page

#### Scenario: Cancel restart

- **WHEN** an analysis exists for CO, the user picks Costa Rica in the header, and cancels the modal
- **THEN** the selected country is still CO, the analysis results are intact, and the page does not change

#### Scenario: Locked on the validation page too

- **WHEN** an analysis exists and the user goes back to `/polygons-validation` and picks another country
- **THEN** the restart modal opens

## REMOVED Requirements

### Requirement: Module cards served at /home

**Reason**: The start page now shows the three steps itself (landing-page capability); a second page with module cards is gone.
**Migration**: `/home` redirects to the start page ("/home redirects to the start page"). Links and bookmarks keep working.

### Requirement: Landing page with country cards

**Reason**: The large country cards are replaced by pills in the start bar, so the three steps fit on one screen.
**Migration**: See "Country choice on the start page", which keeps the same rules (only countries with layers, default Colombia, loading and error states, keyboard use).

### Requirement: Card to request a new country

**Reason**: The "Your country could be next" card is replaced by a link in the start bar.
**Migration**: The "¿Tu país no está? Escríbenos" link in the landing-page capability opens the same `NEXT_PUBLIC_CONTACT_URL` and is hidden when it is unset.
