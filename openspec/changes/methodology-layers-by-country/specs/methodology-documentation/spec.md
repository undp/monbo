## RENAMED Requirements

- FROM: `### Requirement: The deforestation section explains the percentage`
- TO: `### Requirement: The calculation section explains the percentage`

## MODIFIED Requirements

### Requirement: A documentation page explains the methods

The web SHALL serve the methodology page at `/documentation` in Spanish and at `/en/documentation` in English. It SHALL be written for the app's users (producers, cooperatives, exporters, auditors), not for developers. Its eyebrow SHALL read "Metodología" ("Methodology") and its title "Cómo funciona Monbo" ("How Monbo works"); its subtitle SHALL name the layers by country, the calculation, the limits of each source and the farms' upload, validation and area. The page SHALL have seven sections, in this order, each in an element whose `id` is fixed and the same in both languages:

- calculation (`calculation`);
- layer categories (`categories`);
- layers by country (`layers`);
- scope and limits (`limits`);
- farm upload (`upload`);
- polygon validation (`validation`);
- farm area (`area`).

An index SHALL link to the seven anchors: beside the content, and visible while scrolling, on screens 900 px wide or more; above the content on narrower screens. Opening the page with an anchor SHALL scroll to that section with its heading visible below the fixed header, also once the layers by country section has loaded and changed height, unless the user has scrolled meanwhile. The former anchor `#deforestation` SHALL scroll to the calculation section. The page SHALL NOT require an analysis country to be selected.

#### Scenario: Spanish page

- **WHEN** a user opens `/documentation`
- **THEN** the page shows the seven sections in Spanish, in the order calculation, categories, layers, limits, upload, validation, area

#### Scenario: English page

- **WHEN** a user opens `/en/documentation`
- **THEN** the page shows the same seven sections in English, with the same ids

#### Scenario: Direct link to a section

- **WHEN** a user opens `/documentation#layers`
- **THEN** the page scrolls to the layers by country section and its heading is not hidden by the header

#### Scenario: Former deforestation anchor

- **WHEN** a user opens `/documentation#deforestation`
- **THEN** the page scrolls to the calculation section

#### Scenario: Index on a phone

- **WHEN** a user opens `/documentation` on a 390 px wide screen
- **THEN** the index is shown above the content and the page has no horizontal scroll

#### Scenario: No country selected

- **WHEN** a user with no analysis country selected opens `/documentation`
- **THEN** the page is shown and the user is not redirected to the start page

### Requirement: The calculation section explains the percentage

The calculation section SHALL explain, for any layer:

- **The percentage:** the share of the polygon's area that coincides with the layer, written as a plain-text formula, `% del polígono = área que coincide con la capa / área total del polígono × 100`, with both areas measured on the layer rather than with the area shown in the app.
- **What a layer is:** a grid of pixels in which each pixel either marks the layer's subject (forest loss, a protected area, the agricultural frontier) or doesn't; its sources, dates and resolution are listed in the layers by country section, linked from here.
- **Partial pixels:** a pixel the polygon covers only in part counts by that part alone, with a diagram of a marked pixel cut by the polygon's edge.
- **How each area is measured:**
  - every piece of a marked pixel inside the polygon, and the polygon itself, is a polygon given by its corners;
  - its area is computed with Gauss's area formula (the shoelace formula), `A = ½ · | Σ (xᵢ · yᵢ₊₁ − xᵢ₊₁ · yᵢ) |`, in the layer's coordinates;
  - in the body: why the formula works (each edge forms a signed triangle with the origin, and the parts outside the polygon cancel out), with a diagram;
  - in "More detail": the 300 m² piece of the worked example, with corners (0, 0), (30, 0), (30, 5) and (0, 15), computed edge by edge.
- **A worked example:** a 1 ha farm on 30 m pixels of a deforestation layer, with two marked pixels inside it and a third on its edge, giving 21%.
- **How the percentage becomes a result:** it is read through the layer's category (see the categories section): a farm is flagged when its finding is above its category's threshold, which is the category's own or, when it has none, the deployment's deforestation threshold. The section SHALL NOT state any category's threshold as a number, since each country can set its own; it SHALL point to the layers by country section for them and give only the fallback value.
- **No result:** a farm gets no percentage when its polygon is empty, invalid or has no area, when it lies outside the layer, or when the layer can't be read; it is shown as "no data", never as a result without findings.
- **The limit of the method:** the precision stops at the layer's pixel, since a marked pixel counts as marked as a whole.

#### Scenario: Generic formula

- **WHEN** a user reads the calculation section
- **THEN** it states the percentage as the area that coincides with the layer divided by the polygon's total area, without naming deforestation in the formula

#### Scenario: Partial pixel

- **WHEN** a user reads the calculation section
- **THEN** it states that a marked pixel the farm only partly covers adds only the part inside the farm, and it includes the 1 ha example

#### Scenario: Gauss's formula

- **WHEN** a user reads the calculation section
- **THEN** it names Gauss's area formula as the way each area of the percentage is measured, writes the formula, and explains why it works

#### Scenario: Gauss's formula worked out

- **WHEN** a user opens the calculation section's "More detail" on Gauss's formula
- **THEN** it computes the area of the polygon (0, 0), (30, 0), (30, 5), (0, 15) edge by edge, giving ½ · 600 = 300 m², the piece of the third pixel in the 1 ha example

#### Scenario: Farm with no result

- **WHEN** a user reads the calculation section
- **THEN** it lists the cases in which a farm gets no percentage and states that such a farm is "no data", not a result without findings

### Requirement: The page shows the deployment's thresholds

Wherever the page's Markdown mentions the overlap threshold or the deforestation threshold, it SHALL show the values the web loaded from `GET /config`, formatted as a percentage in the page's language with the threshold's own decimal places. The thresholds SHALL NOT be written into the page's text. The Spanish and English content SHALL use the same placeholders, and no placeholder SHALL be left unreplaced in the rendered page, inside a "More detail" block or outside one. A category's own threshold, in the layers by country section, SHALL be the `thresholdPercentage` that `GET /categories` returns, formatted the same way.

#### Scenario: A country's own deforestation threshold

- **WHEN** `GET /config` returns `deforestationThresholdPercentage` 1 and Colombia's "Deforestación" category has `thresholdPercentage` 5
- **THEN** the calculation section doesn't say that "Deforestación" uses 1%, and the Colombia tab shows its threshold as 5%

#### Scenario: Thresholds from the API

- **WHEN** `GET /config` returns `overlapThresholdPercentage` 1 and `deforestationThresholdPercentage` 2, and a user opens `/documentation`
- **THEN** the validation section mentions an overlap threshold of 1% and the calculation section gives 2% as the threshold of a category without its own

#### Scenario: Decimal threshold in English

- **WHEN** `deforestationThresholdPercentage` is 0.5 and a user opens `/en/documentation`
- **THEN** the calculation section shows the fallback threshold as 0.5%

#### Scenario: Threshold of 0

- **WHEN** `overlapThresholdPercentage` is 0
- **THEN** the validation section shows 0% as the threshold, and the sentence remains accurate

#### Scenario: A category's own threshold

- **WHEN** `GET /categories?country=CO` returns a category with `thresholdPercentage` 0.5 and a user opens the Colombia tab in Spanish
- **THEN** that category shows its threshold as 0,5%

#### Scenario: Languages in step

- **WHEN** the unit tests compare the Spanish and English content
- **THEN** both have the same seven sections and use the same placeholders, and every placeholder is a known one

### Requirement: The page and the technical documentation point to each other

Each of these sections SHALL end with a link to its technical document in the repository, on the `dev` branch:

- calculation → `docs/deforestation_calculation.md`;
- upload → the "How farms come in" section of `docs/architecture.md`;
- validation → the polygon-validation section of the API's README;
- area → `docs/polygon_area_calculation.md`.

The layers by country and scope and limits sections SHALL NOT link to a technical document: their content comes from the layers each country publishes. `docs/polygon_area_calculation.md` SHALL contain the technical explanation of the farm area. The repository's technical documents, `docs/architecture.md`'s "How farms come in" included, SHALL name the page's Markdown files as the user-facing version that must be updated along with them.

#### Scenario: Link to the technical detail

- **WHEN** a user reaches the end of the calculation section
- **THEN** a link opens `docs/deforestation_calculation.md` in the repository

#### Scenario: Link from the upload section

- **WHEN** a user reaches the end of the farm upload section
- **THEN** a link opens the "How farms come in" section of `docs/architecture.md` in the repository

#### Scenario: Area document no longer empty

- **WHEN** a developer opens `docs/polygon_area_calculation.md`
- **THEN** it explains how a farm's area is computed (geodesic area on WGS84, holes and parts, point farms)

#### Scenario: Calculation document names the page

- **WHEN** a developer reads `docs/deforestation_calculation.md`
- **THEN** it names `apps/web/src/content/documentation/{es,en}/calculation.md` as the user-facing version to update with it

#### Scenario: Architecture names the upload page

- **WHEN** a developer reads "How farms come in" in `docs/architecture.md`
- **THEN** it names `apps/web/src/content/documentation/{es,en}/upload.md` as the user-facing version to update with it

### Requirement: Each section has a summary and collapsible details

Each section SHALL start, below its heading, with an **"In short"** box ("En resumen" in Spanish) of two or three points. The section's essential rules SHALL be readable with its "More detail" blocks closed. Worked computations, edge cases and exact figures SHALL be in collapsible **"More detail"** blocks ("Más detalle"), closed when the page opens. A user SHALL be able to open and close each block with the mouse and with the keyboard.

The Markdown SHALL mark a summary and a collapsible block with container directives (`:::summary`, `:::details[label]`), with no raw HTML. Both languages SHALL have the same number of summaries and of "More detail" blocks in each section.

With every "More detail" block closed, the Spanish text of the page's Markdown SHALL be at most 1,400 words. The content that comes from the API (categories, layers, considerations) SHALL NOT count toward it.

#### Scenario: Summary first

- **WHEN** a user opens `/documentation#calculation`
- **THEN** the first thing below the section's heading is its "En resumen" box

#### Scenario: Details closed by default

- **WHEN** a user opens `/documentation`
- **THEN** every "Más detalle" block is closed, and clicking one, or focusing it and pressing Enter, opens it

#### Scenario: Languages in step

- **WHEN** the unit tests compare a section's Spanish and English content
- **THEN** both have one summary and the same number of "More detail" blocks

#### Scenario: Unknown directive

- **WHEN** a section's Markdown uses a directive other than `summary` or `details`
- **THEN** a unit test fails

#### Scenario: Word cap

- **WHEN** the unit tests count the words of the Spanish Markdown with every "More detail" block removed
- **THEN** there are at most 1,400

## ADDED Requirements

### Requirement: The categories section explains how a layer's result is read

The categories section SHALL explain, in plain language:

- each country groups its layers into categories, and each category has a name, an icon, a color, a polarity, a threshold and the texts of its two results;
- **polarity "what to avoid"** (deforestation, protected areas): coinciding with the layer is a finding, so the finding is the percentage;
- **polarity "what is allowed"** (agricultural frontier): falling outside the layer is a finding, so the finding is 100% minus the percentage;
- a farm is **with findings** when its finding is above its category's threshold, and **without findings** otherwise; a category without its own threshold uses the deployment's deforestation threshold;
- a farm with no percentage is **no data**, never without findings;
- each country's categories, with their thresholds, are in the layers by country section, linked from here.

Its "More detail" SHALL work out one farm with a 30% percentage under each polarity with a 0% threshold.

#### Scenario: Both polarities

- **WHEN** a user reads the categories section
- **THEN** it explains that coinciding is the finding for "what to avoid" and falling outside is the finding for "what is allowed"

#### Scenario: Worked example

- **WHEN** a user opens the categories section's "More detail"
- **THEN** a farm with 30% coinciding is with findings under "what to avoid" (finding 30%) and under "what is allowed" (finding 70%), both with a 0% threshold

#### Scenario: Default threshold

- **WHEN** `deforestationThresholdPercentage` is 2 and a user reads the categories section
- **THEN** it states that a category without its own threshold uses 2%

### Requirement: The layers by country section lists each country's layers by category

The layers by country section SHALL show one tab per country that `GET /countries` returns, with the country's silhouette and its name in the page's language, sorted by name. The selected tab SHALL show the country's enabled categories from `GET /categories?country=<code>`, in the API's order, and under each category the country's layers from `GET /maps?country=<code>&language=<page language>` whose `categoryId` is that category, in the API's order. Each category SHALL show its icon, color, name and description in the page's language; its polarity in words ("what to avoid" or "what is allowed"); its threshold; and its two result labels, each with its rule stated on what is compared with the threshold: the share of the farm inside the layer for "what to avoid", and the share outside it for "what is allowed". Each layer SHALL show its name and alias, coverage, source, period, resolution and update frequency. The period SHALL be the analysis window, `baseline → comparedAgainst` ("2020 → 2023"), with `contentDate` (the dataset's own range) below it when there is one; a layer without years shows its `contentDate` alone. A missing value SHALL show "—". On screens 900 px wide or more the layers SHALL be a table; on narrower screens, one card per layer with the same fields.

A category with no published layer SHALL say so. A layer whose `categoryId` is not among the categories SHALL be listed under "Other layers", with no polarity or threshold. The section SHALL show a loading state while either request is pending, and a message with a retry button when one fails; a failure SHALL affect only this section and the scope and limits section.

The first selected tab SHALL be the session's analysis country when it is among the tabs, and the first tab otherwise. Switching tabs SHALL NOT change the session's analysis country. The tab's content SHALL be fetched once per country and language while the page is open.

#### Scenario: Three countries

- **WHEN** `GET /countries` returns CO, CR and EC and a user opens `/documentation#layers` in Spanish
- **THEN** the section shows the tabs Colombia, Costa Rica and Ecuador, each with its silhouette

#### Scenario: Layers grouped by category

- **WHEN** Colombia has the categories "Deforestación" and "Áreas protegidas", with GFW and IDEAM in the first and RUNAP in the second
- **THEN** the Colombia tab shows "Deforestación" with GFW and IDEAM, then "Áreas protegidas" with RUNAP

#### Scenario: Category texts and threshold

- **WHEN** the "Áreas protegidas" category has polarity `avoid`, threshold 0 and the result labels "Fuera de áreas protegidas" and "En área protegida"
- **THEN** its block says it marks what to avoid, shows the threshold 0% and both labels, each with its rule on the share inside the layer

#### Scenario: Rule of a "what is allowed" category

- **WHEN** the "Frontera agrícola" category has polarity `required`, threshold 10 and the result labels "Dentro de la frontera agrícola" and "Fuera de la frontera agrícola"
- **THEN** its block says it marks what is allowed, and its labels read "Dentro de la frontera agrícola · fuera de la capa: 10% o menos" and "Fuera de la frontera agrícola · fuera de la capa: más de 10%"

#### Scenario: Period of a layer

- **WHEN** GFW has `baseline` 2020, `comparedAgainst` 2023 and `contentDate` "Datos entre 2000 y 2023"
- **THEN** its period reads "2020 → 2023", with "Datos entre 2000 y 2023" below it

#### Scenario: Session country first

- **WHEN** the session's analysis country is Ecuador and a user opens the page
- **THEN** the Ecuador tab is selected

#### Scenario: Switching tabs leaves the session alone

- **WHEN** the session's analysis country is Ecuador and the user selects the Colombia tab
- **THEN** the Colombia layers are shown and the session's analysis country is still Ecuador

#### Scenario: Request fails

- **WHEN** `GET /maps?country=CO` fails
- **THEN** the section shows an error message with a retry button, and the Markdown sections are shown as usual

#### Scenario: Phone layout

- **WHEN** a user opens the Colombia tab on a 390 px wide screen
- **THEN** each layer is a card with its fields, and the page has no horizontal scroll

### Requirement: The scope and limits section shows each layer's considerations

The scope and limits section SHALL list the layers of the country selected in the layers by country section, grouped like that section, and name that country. Each layer SHALL show its name, its category's chip, and a collapsible block, closed when the page opens, with its considerations from `GET /maps` rendered as Markdown with no raw HTML, and its reference links, opened in a new tab. Only `http` and `https` addresses, in the considerations and in the references, SHALL be links; any other address (`javascript:`, a path of the app such as `/admin`, `mailto:`) SHALL be shown as plain text. A layer without considerations SHALL say so.

#### Scenario: Considerations of the selected country

- **WHEN** the Colombia tab is selected and a user opens the IDEAM block in the scope and limits section
- **THEN** it shows IDEAM's considerations and its reference links

#### Scenario: Follows the tab

- **WHEN** the user selects the Ecuador tab
- **THEN** the scope and limits section names Ecuador and lists Ecuador's layers

#### Scenario: Only web links

- **WHEN** a layer's considerations link to `https://example.org`, `javascript:alert(1)`, `/admin` and `mailto:a@b.c`
- **THEN** only the `https` address is a link, opened in a new tab, and the other three are plain text

#### Scenario: Markdown without HTML

- **WHEN** a layer's considerations contain an HTML tag
- **THEN** the tag is shown as text and not rendered

### Requirement: The landing links to the layers by country

The start page's "Ver capas por país" link ("See layers by country") SHALL open `/documentation#layers` in the current language.

#### Scenario: From the start page

- **WHEN** a user on `/en` follows "See layers by country"
- **THEN** `/en/documentation#layers` opens at the layers by country section
