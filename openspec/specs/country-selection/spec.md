# Country Selection

## Purpose

Define how the analysis country is chosen first: the landing page's country cards (only the
countries that have layers), the `/` and `/home` routes, the single selected country and its
persistence, the header selector and its lock after an analysis, layer lists limited to that
country, and the upload template without a country column.
## Requirements
### Requirement: Module cards served at /home

The page with the three module cards SHALL be served at `/[locale]/home`. Continuing from the landing page SHALL navigate to `/home`. The header's "Home" button and the header logo SHALL go to the landing page (`/`). Every redirect that returns the user to the start of the flow SHALL go to `/home`.

#### Scenario: After choosing a country

- **WHEN** the user selects Colombia on the landing page and continues
- **THEN** the browser navigates to `/home` and shows the three module cards

#### Scenario: Header home button

- **WHEN** the user is on `/polygons-validation` and clicks "Home" in the header
- **THEN** the browser navigates to the landing page

### Requirement: A single selected country, kept for the browser session

The application SHALL hold exactly one selected country (an ISO 3166-1 alpha-2 code) or none. The selection SHALL survive page reloads within the same browser tab session and SHALL NOT survive closing the tab. A stored country that is not among the countries with layers SHALL be discarded, together with the farms and results loaded for it. The previous multi-country preference stored under the `localStorage` key `deforestationAnalysis.selectedCountries` SHALL be removed.

#### Scenario: Reload keeps the country

- **WHEN** the user selected Ecuador and reloads `/home`
- **THEN** Ecuador is still the selected country and the landing page is not shown

#### Scenario: New tab starts without a country

- **WHEN** the user opens the application in a new tab
- **THEN** no country is selected until the landing page preselects Colombia

#### Scenario: Stored country no longer available

- **WHEN** the tab session holds CR and, after a reload, no layer lists CR
- **THEN** the selection is cleared and the user is shown the landing page

#### Scenario: Stored country dropped with a flow loaded

- **WHEN** an analysis for EC is loaded, EC loses its last layer, and the user changes the language
- **THEN** the selection and the loaded farms and results are cleared, and the landing page starts from an empty flow

### Requirement: Module pages require a selected country

Every page under `/home`, `/polygons-validation`, `/deforestation-analysis`, and `/report-generation`, including their sub-pages, SHALL redirect to the landing page when no country is selected. The redirect SHALL NOT happen before the stored selection has been read. The admin pages SHALL NOT require a selected country.

#### Scenario: Direct link without a country

- **WHEN** a user in a new tab opens `/polygons-validation/upload-data`
- **THEN** they are redirected to the landing page

#### Scenario: Admin unaffected

- **WHEN** a user in a new tab opens `/admin/layers`
- **THEN** the admin page is shown without asking for a country

### Requirement: Country selector in the header

On every page, the landing page included, the header SHALL show the selected country's name, placed to the left of the language menu, as a control that lists the available countries. The header SHALL NOT show the selector when no country is selected.

#### Scenario: Selector shows the current country

- **WHEN** the selected country is CO and the language is Spanish
- **THEN** the header shows "Colombia" to the left of the language icon

#### Scenario: Follows the landing page's cards

- **WHEN** the user chooses the Costa Rica card on the landing page
- **THEN** the header shows "Costa Rica"

### Requirement: Changing the country before an analysis

While no deforestation analysis result exists, choosing a different country from the header or the landing page SHALL change the selected country immediately. It SHALL keep the uploaded farms and the polygon validation results, and update the country of every retained farm to the new selection. It SHALL clear the layers selected for the deforestation analysis and for the report. Any in-flight analysis for the previous selection SHALL NOT publish results. This SHALL apply on any page, including the direct deforestation upload page.

#### Scenario: Change during polygon validation

- **WHEN** the user has validated 10 polygons under CO and picks Ecuador in the header
- **THEN** the selected country is EC, the 10 polygons and their validation results remain, every retained farm has `country: "EC"`, and no layer is selected

#### Scenario: Change while an analysis is running

- **WHEN** the user selects Ecuador while an analysis of Colombian layers is still in flight
- **THEN** the Colombian response is ignored, no analysis is sent with an empty layer list, and the user can select Ecuadorian layers

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

- **WHEN** an analysis exists for CO and the user opens the landing page and chooses the Ecuador card
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

The farm upload templates (en and es) SHALL NOT contain a country column, and the upload SHALL NOT require one. Every uploaded farm SHALL be assigned the selected country before it is sent to the API. A country column present in an older file SHALL be used only as a check: when any of its non-empty values differs from the selected country, the upload SHALL be rejected with a translated message naming the countries found. A column that is empty or names only the selected country SHALL be accepted.

#### Scenario: New template

- **WHEN** the user downloads the upload template
- **THEN** it has no "país"/"country" column

#### Scenario: Farms take the selected country

- **WHEN** the selected country is EC and the user uploads a file without a country column
- **THEN** every farm returned by the API has `country: "EC"` and the report cover shows Ecuador's code

#### Scenario: Old template for the selected country

- **WHEN** the selected country is CO and the user uploads an older file whose country column says CO, or is empty
- **THEN** the upload succeeds and every farm has `country: "CO"`

#### Scenario: Old template with farms in another country

- **WHEN** the selected country is CO and the user uploads an older file whose country column says EC for some rows
- **THEN** the upload is rejected with a message naming Ecuador and asking for one country per upload, and no farm is sent to the API

### Requirement: Landing page with country cards

The frontend SHALL serve a landing page at `/[locale]` that asks the user to choose the country for the deforestation analysis. It SHALL show one card per country with layers, and only those countries. Each card SHALL show the country's name, translated to the current language, over its silhouette. The selected card SHALL be highlighted. Choosing a card SHALL select that country; exactly one card SHALL be selected at a time, and the cards SHALL be usable with the keyboard. When the user arrives without a selected country, Colombia SHALL be selected, or the first country if Colombia has no layers. A "Continue with {country}" button SHALL navigate to `/home`. The page SHALL show a loading state until the list of countries has been fetched. If fetching the list fails before any list has arrived, the page SHALL show an error message asking the user to reload the page, instead of the loading state.

#### Scenario: Current countries

- **WHEN** the layers list the country codes EC, CO, and CR
- **THEN** the landing page shows the Colombia, Costa Rica, and Ecuador cards, and no card for any other country

#### Scenario: Default and change

- **WHEN** a user in a new tab opens the landing page and then chooses the Ecuador card
- **THEN** Colombia is selected at first, and after the choice Ecuador's card is highlighted, the header shows Ecuador, and the button reads "Continue with Ecuador"

#### Scenario: Continue

- **WHEN** the user clicks "Continue with Ecuador"
- **THEN** the browser navigates to `/home` with Ecuador as the selected country

#### Scenario: Keyboard selection

- **WHEN** a keyboard user tabs to the Costa Rica card and presses Enter
- **THEN** Costa Rica becomes the selected country

#### Scenario: Countries cannot be fetched

- **WHEN** fetching the countries fails while the landing page loads
- **THEN** the page shows an error message asking to reload the page, and reloading after the API recovers shows the country cards

#### Scenario: New country appears without a frontend change

- **WHEN** an admin enables a layer for PE
- **THEN** after the next refresh the landing page shows a Peru card

### Requirement: Card to request a new country

After the country cards, the landing page SHALL show a "Your country could be next" card with a "Contact us" link that opens the value of `NEXT_PUBLIC_CONTACT_URL`, configured at container start without rebuilding the image. The value MAY be an `https:` URL or a `mailto:` link. The card SHALL NOT select a country. When the variable is empty or unset, the card SHALL NOT be shown.

#### Scenario: Contact URL configured

- **WHEN** `NEXT_PUBLIC_CONTACT_URL` is `mailto:monbo@undp.org`
- **THEN** the card opens a new email to that address

#### Scenario: Contact URL not configured

- **WHEN** `NEXT_PUBLIC_CONTACT_URL` is not set
- **THEN** the landing page shows no card to request a country

