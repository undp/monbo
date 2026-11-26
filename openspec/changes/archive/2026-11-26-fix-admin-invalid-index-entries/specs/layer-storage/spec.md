## ADDED Requirements

### Requirement: Lookups by id skip entries without a valid id

Every lookup of a layer by its id (analysis, tiles, images, and the admin routes) SHALL skip an
index entry whose `id` is not an integer (missing, a string such as `"3"`, a list, or a
boolean), and SHALL keep resolving the other layers of its country. A boolean SHALL never match
an id (`true` is not layer 1). Such an entry SHALL stay out of the listings as MB-3 defined
("Public listing returns enabled layers with version").

#### Scenario: Entry without an id before the requested layer

- **WHEN** CO's `index.json` starts with an entry that has no `id`, and a client posts an
  analysis for `country: "CO"` and `maps: [0]`, and requests a tile of CO's layer 0
- **THEN** the analysis answers 200 with layer 0's results and the tile is rendered

#### Scenario: Boolean id

- **WHEN** CO has no layer 1 and an entry with `id: true`, and a client posts an analysis for
  `maps: [1]`
- **THEN** the analysis answers 400 naming layer 1 as unknown

### Requirement: Analysis refuses a layer whose version is invalid

`POST /layer_analysis/analyze` SHALL answer 400, naming the layer and the field `version`, when
a requested layer's `version` is not an integer of at least 0. It SHALL NOT answer 500.

#### Scenario: Hand-edited version

- **WHEN** CO's layer 0 has `version: "abc"` and a client posts an analysis for `maps: [0]`
- **THEN** the response is 400 and its detail names layer 0 and `version`
