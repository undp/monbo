## ADDED Requirements

### Requirement: The report's layer texts follow the UI language

The layers of the report's choice SHALL carry the texts of the current UI language: when the
analysed layers are refreshed for a new language, the report's chosen layers SHALL be replaced by
the refreshed layers with the same id, keeping the user's choice. A preview or a complete report
SHALL be reused only for the same layer texts: a PDF rendered with other texts SHALL NOT be
downloaded. A change of texts alone SHALL NOT fetch the report's images again.

#### Scenario: PDF after a language change

- **WHEN** the report's layers were chosen in Spanish, the user switches to English and downloads
  the report
- **THEN** the layer names, attributes and considerations in the PDF are the English texts, and no
  Spanish layer text appears

#### Scenario: Texts arrive after the preview was asked for

- **WHEN** the user asks for the preview right after switching the language, before the layer list
  of the new language arrived, and the list then arrives
- **THEN** the shown preview is marked as not matching the current choice, the download renders
  with the new texts, and no image is fetched again
