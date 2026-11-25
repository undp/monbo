## MODIFIED Requirements

### Requirement: Fits a 1366×768 screen and adapts to phones

At a 1366×768 viewport the hero, the three step cards and the "Empezar en {país}" button SHALL be fully visible without scrolling. On a taller screen the page SHALL fill its height: the hero SHALL grow into the spare height with its content centered, so that no blank band is left under the trust row. Below 900 px wide the step cards SHALL stack in one column and the start bar SHALL wrap so that no content overflows horizontally. The entrance animation SHALL be skipped when the user prefers reduced motion.

#### Scenario: Laptop screen

- **WHEN** the start page is opened at a 1366×768 viewport
- **THEN** the three step cards and the "Empezar en …" button are visible without scrolling

#### Scenario: Tall screen

- **WHEN** the start page is opened at a 1920×1080 viewport
- **THEN** the hero is taller than at 1366×768, the trust row ends near the bottom of the screen, and no blank band is left under it

#### Scenario: Phone

- **WHEN** the start page is opened at a 390×844 viewport
- **THEN** the step cards are stacked, the page has no horizontal scroll, and every action is reachable by scrolling down
