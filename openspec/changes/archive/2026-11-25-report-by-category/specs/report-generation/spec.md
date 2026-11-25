## MODIFIED Requirements

### Requirement: Large reports are a ZIP with one PDF per farm

A report SHALL be large when its farm pages exceed 1000. Its farm pages are the pages the complete PDF has about its farms: one sheet per selected farm, also when none of its results could be computed, plus one map page per selected (farm, layer) pair that has a result. A large report SHALL be downloadable only as a ZIP with one PDF per farm: the web SHALL NOT offer the single complete PDF for it, and SHALL say why. A report of 1000 farm pages or fewer SHALL keep offering both downloads.

#### Scenario: Large report download

- **WHEN** the user generates the report for 1000 farms × 4 layers (about 5000 farm pages)
- **THEN** the only download offered is the ZIP with one PDF per farm, and the page explains that large reports are delivered that way

#### Scenario: Small report download

- **WHEN** the user generates the report for 200 farms × 4 layers (1000 farm pages: 200 sheets and 800 maps)
- **THEN** both the complete PDF and the ZIP are offered

#### Scenario: Pages count only farms with a result

- **WHEN** 300 farms × 4 layers are selected, and 60 of those (farm, layer) pairs have no result
- **THEN** the report has 1440 farm pages (300 sheets and 1140 maps), and it is large

#### Scenario: Farms without results still have their sheet

- **WHEN** 2600 farms × 1 layer are selected and only 1000 of them have a result
- **THEN** the report has 3600 farm pages (2600 sheets and 1000 maps), and it is large
