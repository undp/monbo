## ADDED Requirements

### Requirement: The configuration wait stays clear of the header

While the web waits for `GET /config`, and when it shows the error with a retry, its content SHALL
sit below the header on every page. On the start page, whose header is transparent over the hero,
the web SHALL draw the hero's navy behind the header for as long as the wait or the error shows.

#### Scenario: Start page while loading

- **WHEN** the user opens `/` and `GET /config` has not answered
- **THEN** a navy band the height of the header is above the loading card, and the header's links read on it

#### Scenario: Start page after an error

- **WHEN** the user opens `/en` and `GET /config` fails
- **THEN** the error with "Retry" shows below the navy band

#### Scenario: Another page

- **WHEN** the user opens `/territorial-analysis` and `GET /config` has not answered
- **THEN** no band is drawn: the layout's header spacer already keeps the loading card below the header
