## ADDED Requirements

### Requirement: The page has the stage pages' look

The documentation page's body SHALL use the stage pages' look: each section SHALL be a white card with the stage pages' hairline and shadow, its title in the heading font with an icon in a tinted tile, and its text in the stage pages' ink colors. The side index SHALL mark the section being read as the reader scrolls, and the marked link SHALL be announced as the current location.

#### Scenario: Reading the page

- **WHEN** a user opens `/documentation`
- **THEN** each section is a card with its own icon beside its title, and the summaries and "More detail" blocks use the flow's light blue and hairlines

#### Scenario: Following the index

- **WHEN** the user scrolls into the "Capas por país" section
- **THEN** the side index marks "Capas por país" as the current location
