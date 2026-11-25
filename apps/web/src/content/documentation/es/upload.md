## Carga de las fincas

:::summary
- Hay cuatro formas de cargar las fincas, y se pueden combinar.
- Una finca puede ser un polígono (su borde) o un punto (su ubicación).
- Un punto lleva la superficie declarada, o 1 ha si no se indica.
:::

### ¿Qué forma de carga uso?

- **Plantilla Excel:** tienes las coordenadas de cada finca como texto (WKT o GeoJSON).
- **Archivo geográfico con datos:** tus fincas están en un GeoJSON, KML/KMZ o Shapefile que trae sus datos (productor, fecha, cantidad, unidad, cultivo).
- **Archivo geográfico + Excel:** tus fincas están en un archivo geográfico (por ejemplo, de Google Earth) y sus datos en un Excel; se unen por ID.
- **Dibujar en el mapa:** tus fincas no están en un archivo, o son pocas.

En el paso de carga, cada opción muestra sus pasos, su plantilla y un ejemplo.

### ¿Qué geometrías se aceptan?

- **Polígonos**, con o sin **huecos** (una laguna, por ejemplo), de una o **varias partes**.
- **Puntos**, cuando solo se conoce la ubicación de la finca.

Las coordenadas son longitud y latitud en grados (WGS84, el sistema del GPS). Una línea, o una coordenada fuera de rango, se rechaza al cargar.

### ¿Qué superficie tiene un punto?

La **superficie declarada** en el Excel o en el archivo geográfico, o **1 ha** si no se indica. Al dibujar un punto, la superficie es obligatoria. Ver [Superficie de las fincas](#area).

:::details[Más detalle: nombres de atributos, sistemas de coordenadas y límites]
**Nombres de atributos.** En «Archivo geográfico con datos», los datos de cada finca se leen de estos atributos (en GeoJSON, KML o KMZ · en Shapefile). Las mayúsculas no importan.

- Obligatorios: productor (`producerName` · `PRODUCTOR`), fecha de producción (`productionDate` · `FECHA_PROD`), cantidad (`productionQuantity` · `CANTIDAD`), unidad (`productionQuantityUnit` · `UNIDAD`) y cultivo (`cropType` · `CULTIVO`).
- Opcionales: ID (`id` · `ID`), superficie en hectáreas (`area` · `AREA_HA`), región (`region` · `REGION`), asociación (`association` · `ASOCIACION`) y país (`ProducerCountry` · `PAIS`), que solo se compara con el país elegido.

También se aceptan los encabezados de la plantilla Excel y los nombres del GeoJSON de la EUDR (`ProducerName`, `Area`, `ProducerCountry`). Un GeoJSON descargado de Monbo se puede volver a cargar tal cual. En un KML o KMZ sin atributo de ID, el ID de la finca es el nombre del elemento (placemark). Una superficie de 0 cuenta como no indicada.

**Sistemas de coordenadas.** Un archivo geográfico en otro sistema (por ejemplo, UTM) se convierte a WGS84 al leerlo. Un GeoJSON, KML o KMZ sin sistema declarado se lee como WGS84. Un Shapefile **sin su archivo `.prj` se rechaza**, porque sin él no se sabe dónde están sus coordenadas. Las alturas (Z) se descartan.

**Límites.** Un archivo geográfico puede pesar hasta 20 MB, y un `.zip` o `.kmz` puede ocupar hasta 200 MB descomprimido. Un `.zip` puede traer varios Shapefiles, por ejemplo uno de polígonos y otro de puntos.
:::

[Detalle técnico de la carga (en inglés)](https://github.com/undp/monbo/blob/dev/docs/architecture.md#how-farms-come-in)
