# Country Selection

## Purpose

Define how the analysis country is chosen first: the landing map with the countries that have
layers, the `/` and `/home` routes, the single selected country and its persistence, the header
selector and its lock after an analysis, layer lists limited to that country, and the upload
template without a country column.

## Requirements

### Requirement: Landing page with a country map

The frontend SHALL serve a landing page at `/[locale]` that shows a world map and asks the user to choose the country for the deforestation analysis. The countries with layers SHALL be highlighted and SHALL be the only ones that respond to hover and click. The other countries SHALL be drawn in a neutral style and SHALL NOT be selectable. The map's initial view SHALL frame every country with layers. The page SHALL show a loading state until the list of layers has been fetched. If fetching the list fails before any list has arrived, the page SHALL show an error message asking the user to reload the page, instead of the loading state.

#### Scenario: Current countries highlighted

- **WHEN** the layers returned by `GET /maps` list the country codes EC, CO, and CR
- **THEN** Ecuador, Colombia, and Costa Rica are highlighted on the map and every other country is neutral

#### Scenario: Non-available country is inert

- **WHEN** the user clicks Peru on the map while Peru has no layers
- **THEN** nothing happens and no country is selected

#### Scenario: Layers cannot be fetched

- **WHEN** `GET /maps` fails while the landing page loads
- **THEN** the page shows an error message asking to reload the page, and reloading after the API recovers shows the highlighted countries

#### Scenario: New country appears without a frontend change

- **WHEN** an admin enables a layer whose country codes include PE
- **THEN** after the next layer refresh Peru is highlighted and selectable, and the initial view includes it

### Requirement: Accessible list of available countries

The landing page SHALL also list the available countries as buttons with their names translated to the current language. Choosing a country from the list SHALL behave exactly like clicking it on the map. The list SHALL be usable with the keyboard alone.

#### Scenario: Keyboard selection

- **WHEN** a keyboard user tabs to "Costa Rica" in the list and presses Enter
- **THEN** Costa Rica becomes the selected country and the user is taken to `/home`

### Requirement: Contact button to request a new country

The landing page SHALL show a "Contact us to add your country" button that opens the value of `NEXT_PUBLIC_CONTACT_URL`, which is configured at container start without rebuilding the image. The value MAY be an `https:` URL or a `mailto:` link. When the variable is empty or unset, the button SHALL NOT be shown.

#### Scenario: Contact URL configured

- **WHEN** `NEXT_PUBLIC_CONTACT_URL` is `mailto:monbo@undp.org`
- **THEN** the button opens a new email to that address

#### Scenario: Contact URL not configured

- **WHEN** `NEXT_PUBLIC_CONTACT_URL` is not set
- **THEN** the landing page shows no contact button

### Requirement: Module cards served at /home

The page with the three module cards SHALL be served at `/[locale]/home`. Selecting a country on the landing page SHALL navigate to `/home`. The header's "Home" button, the header logo, and every redirect that returns the user to the start of the flow SHALL go to `/home`.

#### Scenario: After choosing a country

- **WHEN** the user selects Colombia on the landing page
- **THEN** the browser navigates to `/home` and shows the three module cards

#### Scenario: Header home button

- **WHEN** the user is on `/polygons-validation` and clicks "Home" in the header
- **THEN** the browser navigates to `/home`

### Requirement: A single selected country, kept for the browser session

The application SHALL hold exactly one selected country (an ISO 3166-1 alpha-2 code) or none. The selection SHALL survive page reloads within the same browser tab session and SHALL NOT survive closing the tab. A stored country that is not among the countries with layers SHALL be discarded. The previous multi-country preference stored under the `localStorage` key `deforestationAnalysis.selectedCountries` SHALL be removed.

#### Scenario: Reload keeps the country

- **WHEN** the user selected Ecuador and reloads `/home`
- **THEN** Ecuador is still the selected country and the landing page is not shown

#### Scenario: New tab starts on the map

- **WHEN** the user opens the application in a new tab
- **THEN** no country is selected

#### Scenario: Stored country no longer available

- **WHEN** the tab session holds CR and, after a reload, no layer lists CR
- **THEN** the selection is cleared and the user is shown the landing page

### Requirement: Module pages require a selected country

Every page under `/home`, `/polygons-validation`, `/deforestation-analysis`, and `/report-generation`, including their sub-pages, SHALL redirect to the landing page when no country is selected. The redirect SHALL NOT happen before the stored selection has been read. The admin pages SHALL NOT require a selected country.

#### Scenario: Direct link without a country

- **WHEN** a user in a new tab opens `/polygons-validation/upload-data`
- **THEN** they are redirected to the landing page

#### Scenario: Admin unaffected

- **WHEN** a user in a new tab opens `/admin/layers`
- **THEN** the admin page is shown without asking for a country

### Requirement: Country selector in the header

On every page except the landing page, the header SHALL show the selected country's name, placed to the left of the language menu, as a control that lists the available countries. The header SHALL NOT show the selector when no country is selected.

#### Scenario: Selector shows the current country

- **WHEN** the selected country is CO and the language is Spanish
- **THEN** the header shows "Colombia" to the left of the language icon

#### Scenario: Hidden on the landing page

- **WHEN** the user is on the landing page
- **THEN** the header shows no country selector

### Requirement: Changing the country before an analysis

While no deforestation analysis result exists, choosing a different country from the header or the landing page SHALL change the selected country immediately. It SHALL keep the uploaded farms and the polygon validation results. It SHALL clear the layers selected for the deforestation analysis and for the report. This SHALL apply on any page, including the direct deforestation upload page.

#### Scenario: Change during polygon validation

- **WHEN** the user has validated 10 polygons under CO and picks Ecuador in the header
- **THEN** the selected country is EC, the 10 polygons and their validation results remain, and no layer is selected

### Requirement: Country locked after an analysis, with a restart confirmation

Once a deforestation analysis result exists, choosing a different country SHALL NOT change it directly. It SHALL open a modal explaining that changing the country requires starting a new analysis and uploading the polygons again. The lock SHALL depend only on whether an analysis result exists, not on the current page. The same rule SHALL apply when the choice is made on the landing page.

- If the user accepts, the application SHALL clear the farms, the polygon validation results, the analysis results, and the analysis and report parameters, SHALL set the new country, and SHALL navigate to `/home`.
- If the user cancels, nothing SHALL change and the user SHALL stay on the same page.

#### Scenario: Accept restart

- **WHEN** an analysis exists for CO, the user picks Costa Rica in the header, and accepts the modal
- **THEN** all loaded data is cleared, the selected country is CR, and the browser shows `/home`

#### Scenario: Cancel restart

- **WHEN** an analysis exists for CO, the user picks Costa Rica in the header, and cancels the modal
- **THEN** the selected country is still CO, the analysis results are intact, and the page does not change

#### Scenario: Locked on the validation page too

- **WHEN** an analysis exists and the user goes back to `/polygons-validation` and picks another country
- **THEN** the restart modal opens

#### Scenario: Landing page cannot bypass the lock

- **WHEN** an analysis exists for CO and the user opens the landing page and clicks Ecuador
- **THEN** the restart modal opens

### Requirement: Layer choices restricted to the selected country

The deforestation modal on the polygon validation page and the deforestation upload page SHALL NOT show a country selector. They SHALL list only the layers whose countries include the selected country. When the selected country has no layers, they SHALL show a message saying no layers are available.

#### Scenario: Layers for Costa Rica

- **WHEN** the selected country is CR and the user opens the deforestation modal
- **THEN** the modal lists GFW, TMF, and MOCUPP, and shows no country selector

#### Scenario: Country left without layers

- **WHEN** every layer for the selected country is disabled during the session
- **THEN** the modal shows the "no layers available" message and the continue button stays disabled

### Requirement: Upload template without a country column

The farm upload templates (en and es) SHALL NOT contain a country column, and the upload SHALL NOT require one. Every uploaded farm SHALL be assigned the selected country before it is sent to the API. A country column present in an uploaded file SHALL be ignored.

#### Scenario: New template

- **WHEN** the user downloads the upload template
- **THEN** it has no "país"/"country" column

#### Scenario: Farms take the selected country

- **WHEN** the selected country is EC and the user uploads a file without a country column
- **THEN** every farm returned by the API has `country: "EC"` and the report cover shows Ecuador's code

#### Scenario: Old template still accepted

- **WHEN** the selected country is CO and the user uploads a file whose country column says EC
- **THEN** the upload succeeds and every farm has `country: "CO"`

