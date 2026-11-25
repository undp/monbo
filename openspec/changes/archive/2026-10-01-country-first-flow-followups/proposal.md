## Why

`country-first-flow` was archived describing a landing page with a world map. The landing page then moved to country cards, "Home" and the logo moved to `/`, and the header selector started showing on the landing page. Those edits went straight into `openspec/specs/country-selection/spec.md` instead of through a change, so the archive records a design that never shipped. The review of #38 also found two places where the flow could carry a wrong country:
- an older template's country column was dropped and its farms relabeled without a warning;
- dropping a stored country kept its farms and results loaded.

## What Changes

- Record the card-based landing page as a change to `country-selection`:
  - the map and its keyboard list give way to one card per country, with Colombia preselected and a "Continue with {country}" button;
  - the contact button becomes a "Your country could be next" card;
  - "Home" and the logo go to `/`;
  - the header selector also shows on the landing page;
  - a country change updates the retained farms' country and ignores in-flight analyses.
- **An older template's country column is checked, not ignored.** If any non-empty value differs from the selected country, the upload is rejected with a translated message naming the countries found. An empty column, or one that names the selected country, is still accepted.
- **Dropping a stored country that no longer has layers also clears the farms and results loaded for it,** so the landing page starts from an empty flow instead of selecting another country under them.

## Capabilities

### New Capabilities

None.

### Modified Capabilities
- `country-selection`:
  - the landing page with country cards and the card to request a country, replacing the map, the keyboard list and the contact button;
  - "Home" and the logo going to `/`;
  - the header selector on the landing page;
  - farms relabeled on a country change;
  - a dropped stored country clearing its flow;
  - an older template's country column checked against the selected country.

## Impact

- **Specs:** `openspec/specs/country-selection/spec.md` gets the text it already has for the cards, plus the two new rules.
- **Frontend (`monbo-front`):**
  - `utils/excel.ts` and both upload pages check an older template's country column;
  - `context/DataContext.tsx` clears the flow when it drops the stored country;
  - the `common:parseFileError:otherCountry` text is added in `es` and `en`.

  The card landing page itself was built before this change.
- **API:** none.
