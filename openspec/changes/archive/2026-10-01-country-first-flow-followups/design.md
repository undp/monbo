## Context

The landing page shipped as country cards, but `country-first-flow` was archived describing a map, and the main spec was then edited by hand. The review of #38 asked for those edits to go through a change, and found two ways the flow could end up with farms that don't belong to the selected country.

## Goals / Non-Goals

**Goals:**
- The archive history explains the current `country-selection` spec.
- A report never states a country the farms aren't in.

**Non-Goals:**
- Analyzing farms of several countries in one flow: one analysis is still one country's layers.
- Changing the card landing page's behavior, which is already built.

## Decisions

### D1. Check an older template's country column instead of ignoring it

The upload stamps the selected country on every farm. An older template can still carry a country column, which used to be dropped. A file with farms in Ecuador, uploaded with Colombia selected, was then analyzed against Colombian layers, and its report and exports said Colombia.

`loadExcelFileFarmsData` now reads the column again, only to compare it with the selected country. Any non-empty value that differs rejects the file with one message naming the countries found, before any farm is sent to `/farms/parse`. The column is then removed from the rows, so the farms still get the selected country.

*Alternative:* a warning that lets the upload continue. Rejected: the result would still state the wrong country, and the user can split the file.

### D2. Clear the flow when dropping a stored country

`DataProvider` drops a stored country that has no layers. The provider also remounts on a language change and keeps the flow in `keptState`, so the check can run with a flow loaded. Dropping the country now runs `resetAnalysis()` as well, so the landing page's default selection never lands under another country's farms.

## Risks / Trade-offs

- [A user with an older multi-country file now has to split it] → The message names the countries and asks for one per upload, and the new templates have no country column at all.
