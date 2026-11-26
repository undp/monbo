## MODIFIED Requirements

### Requirement: /home redirects to the start page

`/[locale]/home` SHALL NOT render a page of its own. It SHALL answer a permanent redirect (HTTP 308) to the start page of the same language (`/[locale]`), whether or not a country is selected, like the other retired routes. Every in-app redirect that returns the user to the start of the flow SHALL go to the start page. The header's "Home" button and the header logo SHALL go to the start page.

#### Scenario: Spanish

- **WHEN** the user opens `/es/home`
- **THEN** the response is a 308 and the browser ends on the Spanish start page (`/es`, served as `/`)

#### Scenario: English

- **WHEN** the user opens `/en/home`
- **THEN** the response is a 308 and the browser ends on `/en`

#### Scenario: Data cleared on a module page

- **WHEN** the user is on `/polygons-validation` and the loaded farms are cleared
- **THEN** the browser navigates to the start page
