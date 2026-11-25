## 1. Spec catch-up

- [x] 1.1 Record the card landing page, the request card, "Home" and the logo going to `/`, the header selector on the landing page, and relabeling on a country change as deltas to `country-selection`, from the text `openspec/specs/country-selection/spec.md` already had (built in 3757ffd, e8dfe73, 6b7416a)

## 2. Older templates

- [x] 2.1 Read the country column of an older template in `loadExcelFileFarmsData`, reject the file when a non-empty value differs from the selected country, and keep stamping the selected country (a6d2c27)
- [x] 2.2 Add `common:parseFileError:otherCountry` in `es` and `en`, and update the CHANGELOG, `docs/onboarding.md` and `docs/excel_integration` (a6d2c27)

## 3. Dropped stored country

- [x] 3.1 Run `resetAnalysis()` when `DataProvider` drops a stored country that has no layers (1c64232)
