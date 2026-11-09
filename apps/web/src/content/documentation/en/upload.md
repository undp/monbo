## Farm upload

:::summary
- There are four ways to upload farms, and they can be combined.
- A farm can be a polygon (its boundary) or a point (its location).
- A point takes its declared area, or 1 ha if none is given.
:::

### Which way should I use?

- **Excel template:** you have each farm's coordinates as text (WKT or GeoJSON).
- **Geo file with data:** your farms are in a GeoJSON, KML/KMZ or Shapefile that carries their data (producer, date, quantity, unit, crop).
- **Geo file + Excel:** your farms are in a geo file (for example, from Google Earth) and their data in an Excel; they are joined by ID.
- **Draw on the map:** your farms aren't in a file, or there are only a few.

In the upload step, each option shows its steps, its template and an example.

### Which geometries are accepted?

- **Polygons**, with or without **holes** (a lagoon, for example), in one or **several parts**.
- **Points**, when only the farm's location is known.

Coordinates are longitude and latitude in degrees (WGS84, the GPS system). A line, or a coordinate out of range, is rejected on upload.

### What area does a point have?

The **area declared** in the Excel or in the geo file, or **1 ha** if none is given. When drawing a point, its area is required. See [Farm area](#area).

:::details[More detail: attribute names, coordinate systems and limits]
**Attribute names.** In "Geo file with data", each farm's data is read from these attributes (in GeoJSON, KML or KMZ · in a Shapefile). Case doesn't matter.

- Required: producer (`producerName` · `PRODUCTOR`), production date (`productionDate` · `FECHA_PROD`), quantity (`productionQuantity` · `CANTIDAD`), unit (`productionQuantityUnit` · `UNIDAD`) and crop (`cropType` · `CULTIVO`).
- Optional: ID (`id` · `ID`), area in hectares (`area` · `AREA_HA`), region (`region` · `REGION`), association (`association` · `ASOCIACION`) and country (`ProducerCountry` · `PAIS`), which is only checked against the selected country.

The Excel template's headers and the EUDR GeoJSON names (`ProducerName`, `Area`, `ProducerCountry`) are accepted too. A GeoJSON downloaded from Monbo can be uploaded again as it is. In a KML or KMZ with no ID attribute, the farm's ID is the placemark's name. An area of 0 counts as not given.

**Coordinate systems.** A geo file in another system (UTM, for example) is converted to WGS84 when it is read. A GeoJSON, KML or KMZ with no declared system is read as WGS84. A Shapefile **without its `.prj` file is rejected**, because without it there is no way to know where its coordinates are. Heights (Z) are dropped.

**Limits.** A geo file can weigh up to 20 MB, and a `.zip` or `.kmz` can take up to 200 MB uncompressed. A `.zip` can hold several Shapefiles, for example one of polygons and one of points.
:::

[Technical detail of the upload](https://github.com/undp/monbo/blob/dev/docs/architecture.md#how-farms-come-in)
