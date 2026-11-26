## ADDED Requirements

### Requirement: Ingestion refuses a layer with invalid index fields

`PUT /admin/layers/{id}/raster` SHALL answer 400, naming the layer and the field, before
staging the body, when the layer's `version`, `pixel_size` or `raster_filename` has an invalid
type (by the rules of "Public listing returns enabled layers with version" in `layer-storage`).
The job SHALL check those fields again before converting and under the store lock before
activating; when one became invalid meanwhile, the job SHALL fail with the code
`invalid_fields`, whose params name the field, and SHALL leave the layer unchanged and no
staging file behind. It SHALL NOT fail as `unexpected` for this reason. The admin UI SHALL show
the API's reason for a 400 on the upload and SHALL translate `invalid_fields` in both
languages.

#### Scenario: Upload to a layer with an invalid version

- **WHEN** an admin uploads a raster to CO's layer 9, whose `version` is `"abc"`
- **THEN** the response is 400 naming layer 9 and `version`, no job is created and no staging
  file remains

#### Scenario: Version edited by hand during the job

- **WHEN** layer 9's `version` becomes `"3"` after the upload was accepted and before the
  activation
- **THEN** the job fails with code `invalid_fields` naming `version`, the layer keeps its
  raster and version, and no staging file remains
