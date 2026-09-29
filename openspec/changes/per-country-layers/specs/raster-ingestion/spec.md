## ADDED Requirements

### Requirement: Ingestion scoped to the admin's country

`PUT /admin/layers/{id}/raster` SHALL accept only layers of the country in the admin's session. Ids that belong to another country SHALL answer 404, like unknown ids. A successful ingestion SHALL store the raster in that country's `layers/rasters/` folder. Each job SHALL record its country, and `GET /admin/jobs/{jobId}` SHALL answer 404 for jobs of another country. Only one ingestion SHALL run at a time across all countries. The 409 returned while another country's job runs SHALL NOT reveal that country.

#### Scenario: Upload to another country's layer

- **WHEN** a CO admin uploads a raster to layer 5, which belongs to CR
- **THEN** the response is 404 and no staging file remains

#### Scenario: Raster stored in the country folder

- **WHEN** an EC admin's upload for layer 4 at version 1 succeeds
- **THEN** the layer points to `ecuador2-v2.tif` inside `EC/layers/rasters/`

#### Scenario: Another country's job

- **WHEN** a CR admin polls a job started by a CO admin
- **THEN** the response is 404

#### Scenario: Concurrent uploads from two countries

- **WHEN** a CR admin uploads while a CO ingestion is running
- **THEN** the response is 409 with a message that another upload is in progress, without naming CO
