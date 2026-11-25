## MODIFIED Requirements

### Requirement: Layers resolvable by id regardless of enabled state

Deforestation analysis, tile serving, and image generation SHALL resolve a layer by its country and its id, whether the layer or its country is enabled or disabled. `POST /layer_analysis/analyze` and `POST /layer_analysis/generate-image` SHALL take the country as `country` in the body. Tiles SHALL be served at `/layer_analysis/tiles/{country}/{id}/dynamic/{z}/{x}/{y}.png`. In the per-country layout, a request without a country SHALL be rejected with 422. In the legacy flat layout the country SHALL be optional, and when it is given, the layer SHALL list it.

#### Scenario: Analysis on a disabled layer

- **WHEN** a client posts an analysis request with a country and the id of one of its disabled layers
- **THEN** the API computes results for that layer as it would for an enabled one

#### Scenario: Tiles of a copied layer

- **WHEN** a client requests `/layer_analysis/tiles/CO/0/dynamic/8/75/120.png` and CO's layer 0 is its copy of GFW
- **THEN** the tile is rendered from `CO/layers/rasters/`

#### Scenario: Same id in two countries

- **WHEN** a client posts an analysis for `country: "CR"` and `maps: [2]`
- **THEN** the results are those of Costa Rica's layer 2 (MOCUPP), not of Colombia's layer 2 (IDEAM)

#### Scenario: Country missing

- **WHEN** the root uses the per-country layout and a client posts an analysis without `country`
- **THEN** the response is 422
