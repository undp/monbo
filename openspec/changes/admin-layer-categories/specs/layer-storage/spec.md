## MODIFIED Requirements

### Requirement: Public listing returns enabled layers with version

`GET /maps` SHALL return only the layers that are consistent enough to be analyzed: enabled, whose category resolves and is enabled, whose years fit that category (both `baseline` and `compared_against` for a temporal category, neither for any other; a value that is not a year never fits), and whose raster file exists. This SHALL hold whatever produced the index, including a hand edit of the share. A layer left out for its years or its raster SHALL be logged once as an error naming the country, the layer, and the reason, SHALL be readable from the storage module (`layer_issue`), and SHALL still resolve by id for analysis, tiles, and images, like a disabled layer. It SHALL accept an optional `country` query parameter. When the parameter is given, it SHALL return only that country's layers, and it SHALL return an empty list for a country that is unknown or disabled. When the parameter is omitted, it SHALL return the enabled layers of every enabled country. Each returned layer SHALL include its `version`, `availableCountriesCodes`, and `categoryId`. In the per-country layout, `availableCountriesCodes` SHALL contain exactly the layer's country.

#### Scenario: Disabled layer hidden from listing

- **WHEN** layer 4 is disabled and a client calls `GET /maps`
- **THEN** layer 4 is not in the response

#### Scenario: Layer of a disabled category hidden from listing

- **WHEN** CO's layer 3 is enabled, its category `frontier` is disabled, and a client calls `GET /maps?country=CO`
- **THEN** layer 3 is not in the response, and it still resolves by id for analysis and tiles

#### Scenario: Hand-edited layer whose years don't fit

- **WHEN** a hand edit leaves CO's layer 3 enabled in `deforestation` with `baseline: "2020"` and `compared_against: null`, or with `baseline: "2020a"`
- **THEN** `GET /maps?country=CO` doesn't list layer 3 and answers 200, and an error names CO, layer 3, and the reason

#### Scenario: Hand-edited layer without raster

- **WHEN** a hand edit leaves CO's only enabled layer pointing at a raster file that doesn't exist
- **THEN** `GET /maps?country=CO` returns an empty list and `GET /countries` doesn't offer CO

#### Scenario: Version exposed

- **WHEN** a client calls `GET /maps`
- **THEN** each layer object contains an integer `version`

#### Scenario: Category exposed

- **WHEN** a client calls `GET /maps?country=CO` and CO's layers have no `category_id`
- **THEN** each layer object contains `categoryId: "deforestation"`

#### Scenario: Filter by country

- **WHEN** a client calls `GET /maps?country=CR`
- **THEN** the response lists only CR's enabled layers (GFW, TMF, and MOCUPP, ids 0, 1, and 2), each with `availableCountriesCodes: ["CR"]`

#### Scenario: Unknown country

- **WHEN** a client calls `GET /maps?country=PE` and PE is not registered
- **THEN** the response is 200 with an empty list
