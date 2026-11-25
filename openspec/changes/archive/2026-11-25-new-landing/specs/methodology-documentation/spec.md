

## RENAMED Requirements

- FROM: `### Requirement: The header links to the documentation`
- TO: `### Requirement: The header links to the documentation (superseded)`

## REMOVED Requirements

### Requirement: The header links to the documentation (superseded)

**Reason**: The previous version of the requirement, replaced whole by the one of the same name under ADDED: it drops or renames scenarios ("From the landing page", "Tooltip"), which a MODIFIED block can't express.

**Migration**: None; the requirement keeps its name.

## ADDED Requirements

### Requirement: The header links to the documentation

The header SHALL show the "Metodología" link ("Methodology" in English) of its navigation on every page: the start page, the modules, the documentation page and the admin pages. It replaces the former book icon button. Activating it SHALL open the documentation page in the current language. While the documentation page is open, the link SHALL be shown as active (`aria-current="page"`).

#### Scenario: From the start page

- **WHEN** a user on the start page, with no country selected, clicks "Metodología"
- **THEN** `/documentation` opens

#### Scenario: From an admin page in English

- **WHEN** a user on `/en/admin` clicks "Methodology"
- **THEN** `/en/documentation` opens

#### Scenario: Active on the page

- **WHEN** a user is on `/documentation`
- **THEN** the "Metodología" link is marked as the current page

#### Scenario: Switching language on the page

- **WHEN** a user on `/documentation#area` switches the language to English
- **THEN** `/en/documentation` opens, with the content in English
