## ADDED Requirements

### Requirement: Analysed layer texts follow the UI language

The texts of the analysed layers (name, alias, coverage, source, resolution, content date, update
frequency, publish date and considerations) SHALL be shown in the current UI language in the
"Detalles de las capas" modal and in the Excel and GeoJSON exports, also after the user switched
the language with an analysis loaded. Switching the language SHALL NOT run the analysis again nor
change a layer's calculation fields (version, pixel size, baseline, compared year, category).

While an analysis has results, the web SHALL keep the texts of its layers in every UI language,
fetching `GET /maps` once for each language it has not seen them in. A layer hidden after the
analysis (no longer listed by `GET /maps`) SHALL take its texts in the current language from what
was kept. When those texts were never received (the extra fetch failed), the layer SHALL keep its
last texts.

#### Scenario: Modal after a language change

- **WHEN** GFW was analysed in English, the user switches to Spanish and opens "Detalles de las
  capas"
- **THEN** the chip and every detail of the first layer are the Spanish texts of
  `GET /maps?language=es`, without clicking another chip

#### Scenario: Hidden layer in the exports

- **WHEN** GFW and "Áreas test" were analysed in Spanish, the category of "Áreas test" is then
  disabled, and the user switches to English and exports the Excel
- **THEN** the columns of the hidden layer name it with its English alias ("Test areas"), under
  "No category"

#### Scenario: Texts of the other language unavailable

- **WHEN** the extra `GET /maps` in English failed, a layer is then hidden, and the user switches
  to English
- **THEN** that layer keeps its Spanish texts, and its results stay
