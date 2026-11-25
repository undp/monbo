## MODIFIED Requirements

### Requirement: The data provider is covered

The suite SHALL mount the real `DataProvider`, with `getCountries` and `getMaps` replaced by test doubles and fake timers driving the layer polling and the minimum gap between on-demand refreshes. It SHALL cover:

- **Analysis invalidation:** a polled layer whose calculation inputs changed invalidates the analysis. Those inputs are `version`, `pixelSize`, `baseline` and `comparedAgainst`.
- **Layer refresh:** metadata-only changes refresh the selection without invalidating it.
- **Hidden layers:** a hidden layer is kept while an analysis uses it, and deselected otherwise.
- **The stored country:** one that no longer has layers is dropped once per mount.
- **Error states:** the countries and layers error states, a failed refresh, and responses that arrive after the country changed.
- **The flow:** it is kept across a remount, and `resetAnalysis` clears it.
- **On-demand refresh:** returning to the tab and the context's `refreshAvailableMaps` refetch the lists, a refetched list invalidates like a polled one, and triggers within the minimum gap or during a fetch in flight send no request.

#### Scenario: A new raster invalidates the analysis

- **WHEN** analysis results exist for layer 1 at version 1 and the next poll of `/maps` returns layer 1 at version 2
- **THEN** the results are cleared, the report's selected layers, farms and download type are cleared, and `analysisOutdated` is true
- **AND** the selected layer carries version 2

#### Scenario: A renamed layer is refreshed without invalidating

- **WHEN** analysis results exist and the next poll returns the selected layer with only a new name
- **THEN** the results are kept and the selected layer carries the new name

#### Scenario: A hidden layer

- **WHEN** the next poll no longer lists a selected layer
- **THEN** the layer stays selected if analysis results exist, and is deselected if they don't

#### Scenario: A stored country without layers

- **WHEN** the session storage holds `PE` and the first `/countries` response doesn't include it
- **THEN** the selected country becomes null and the analysis flow is reset

#### Scenario: A late response for the previous country

- **WHEN** the selected country changes from `CR` to `PE` while `/maps` for `CR` is still pending, and that response then arrives
- **THEN** the available layers stay those of `PE`

#### Scenario: The flow survives a language change

- **WHEN** farms are loaded, the provider unmounts, and it mounts again with another locale
- **THEN** the farms are still loaded

#### Scenario: Returning to the tab refreshes both lists

- **WHEN** 30 seconds have passed since the last fetches and `visibilitychange` fires with the document visible
- **THEN** `getCountries` and `getMaps` are each called once more, and the new layer in the `/maps` response is in `availableMaps`

#### Scenario: Visibility and focus together cost one request

- **WHEN** 30 seconds have passed since the last fetches and `visibilitychange` and `focus` fire one after the other
- **THEN** `getCountries` and `getMaps` are each called only once more

#### Scenario: A refresh within the gap is skipped

- **WHEN** `refreshAvailableMaps` is called less than 30 seconds after the last `/maps` fetch
- **THEN** `getMaps` is not called again

#### Scenario: A refresh while a fetch is in flight is skipped

- **WHEN** `refreshAvailableMaps` is called while a `/maps` request is still pending
- **THEN** `getMaps` is not called again

#### Scenario: An on-demand refresh invalidates like a poll

- **WHEN** analysis results exist for layer 1 at version 1, and `refreshAvailableMaps` returns layer 1 at version 2
- **THEN** the results are cleared and `analysisOutdated` is true

#### Scenario: A hidden tab does not refresh

- **WHEN** `visibilitychange` fires with the document hidden
- **THEN** neither `getCountries` nor `getMaps` is called
