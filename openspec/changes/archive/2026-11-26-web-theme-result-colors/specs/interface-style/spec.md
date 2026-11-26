## ADDED Requirements

### Requirement: Result colors come from the theme

The colors the web uses to paint a result (ok, flagged and no data, as text and background), the
summary meter's segments, the neutral chip and the layer's swatch in the map legend SHALL be
defined once, in the theme's `result` palette, and components SHALL read them from there. The PDF
report SHALL use the same values.

#### Scenario: A no-data chip

- **WHEN** a layer has no result for any farm and its counter chip is shown
- **THEN** the chip's background and text use the theme's no-data colors

#### Scenario: Changing a result color

- **WHEN** the theme's flagged meter color is changed
- **THEN** the summary cards' meter paints its flagged segment in the new color, with no other file edited

### Requirement: The page eyebrow is legible

The eyebrow above a page's title SHALL have a contrast of at least 4.5:1 against white and against
the stage pages' light blue (`#f4f9fd`).

#### Scenario: Methodology page

- **WHEN** the user opens the methodology page
- **THEN** the "Metodología" eyebrow is painted in a green with at least 4.5:1 contrast on its background
