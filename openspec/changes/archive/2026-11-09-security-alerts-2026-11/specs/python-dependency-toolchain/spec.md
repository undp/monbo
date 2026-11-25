## ADDED Requirements

### Requirement: Pillow majors keep rendered images within the baseline

A Pillow major upgrade in `apps/api` SHALL pass the numeric baseline's rendered-image comparison (decoded images: equal dimensions and channels, at most 0.1% differing channel values, each within 1 level) without regenerating the baseline. Before the upgrade merges, its release notes SHALL be checked against the Pillow APIs the API calls, and any change that applies SHALL be named in the pull request with how it was handled.

#### Scenario: Pillow 13 lands

- **WHEN** `pillow` moves from 12.3.0 to 13.0.0 in `apps/api`
- **THEN** `test_numeric_baseline` passes against the committed reference, with no change to the baseline files
- **AND** the pull request states which Pillow 13 breaking changes apply to the API's calls, or that none do

#### Scenario: A Pillow major changes rendering beyond tolerance

- **WHEN** a Pillow major makes the rendered tile differ beyond the baseline's tolerances
- **THEN** the upgrade is blocked until the difference is explained, and a reviewed rationale accepts a new baseline
