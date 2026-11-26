## ADDED Requirements

### Requirement: Admin routes answer invalid index entries with 400

The admin routes SHALL never answer 500 because of an index entry with a field of an invalid
type (a hand edit of the share):

- Resolving a layer by id (`PUT`, `PATCH`, the raster upload) SHALL skip entries whose `id` is
  not an integer (see `layer-storage`, "Lookups by id skip entries without a valid id"); an
  unknown id SHALL still answer 404.
- `POST /admin/layers` SHALL answer 400 while any entry of the session's country has an `id`
  that is not an integer, naming the entry by its position in the index and its value (or
  "missing"), and SHALL write nothing. Another entry's file name that is not a string SHALL NOT
  make it fail.
- `PUT /admin/layers/{id}` SHALL answer 400, naming the layer and the field, when the layer's
  `attributes_filename`, `considerations_filename` or `raster_filename` is invalid, and SHALL
  write neither metadata nor the index. A missing or invalid `pixel_size` or `references` SHALL
  NOT make it fail: the request replaces them.
- `GET /admin/categories` and the category writes SHALL leave entries without a valid id out of
  `publishedLayerCount` and out of the layers they name; such an entry is not public.

#### Scenario: Create with an invalid id in the index

- **WHEN** CO's index has an entry with `id: "abc"` at position 2 and a CO admin posts a valid
  layer
- **THEN** the response is 400, its detail names position 2 and `"abc"`, and neither the index
  nor any metadata file changes

#### Scenario: Create next to an invalid file name

- **WHEN** CO's layer 7 has `attributes_filename: 5` and a CO admin posts a valid layer
- **THEN** the layer is created with the next id

#### Scenario: Edit a layer after an entry without an id

- **WHEN** CO's index starts with an entry without `id` and a CO admin edits or disables
  layer 0
- **THEN** the change is saved

#### Scenario: Edit a layer whose file name is invalid

- **WHEN** CO's layer 7 has `considerations_filename: 5` and a CO admin puts new texts for it
- **THEN** the response is 400 naming layer 7 and `considerations_filename`, and no attributes
  or considerations file is written

#### Scenario: Repair a missing pixel size

- **WHEN** CO's layer 7 has no `pixel_size` and a CO admin puts it with `pixel_size: 31`
- **THEN** the change is saved and layer 7's `pixel_size` is 31

#### Scenario: Categories with an entry without an id

- **WHEN** CO has an enabled entry without `id` in `deforestation` and a CO admin calls
  `GET /admin/categories`
- **THEN** the response is 200 and that entry is not counted in `publishedLayerCount`
