## MODIFIED Requirements

### Requirement: Module pages require a selected country

Every page under `/polygons-validation`, `/territorial-analysis`, and `/report-generation`, including their sub-pages, SHALL redirect to the start page when no country is selected. The redirect SHALL NOT happen before the stored selection has been read. The start page and the admin pages SHALL NOT require a selected country.

#### Scenario: Direct link without a country

- **WHEN** a user in a new tab opens `/polygons-validation/upload-data`
- **THEN** they are redirected to the start page

#### Scenario: Admin unaffected

- **WHEN** a user in a new tab opens `/admin/layers`
- **THEN** the admin page is shown without asking for a country
