# Documentación del Manejo de Capas/Mapas en la Aplicación de Análisis de Deforestación (Español)

## Estructura de Archivos

- **Índice de Capas:** `app/maps/index.json`
- **Capas Raster:** `app/maps/layers/rasters/*.tif`
- **Metadatos de Capas:** `app/maps/metadata/attributes/<language>/*.json`
- **Consideraciones de Capas:** `app/maps/metadata/considerations/<language>/*.md`

## Estructura del Índice de Capas

El archivo `app/maps/index.json` contiene un listado de objetos JSON, cada uno representando una capa de análisis. Estructura:

```json
[
  {
    "id": 0,
    "raster_filename": "gfw.tif",
    "attributes_filename": "gfw.json",
    "considerations_filename": "gfw.md",
    "pixel_size": 30,
    "baseline": "2020",
    "compared_against": "2023",
    "references": [
      "https://glad.earthengine.app/view/global-forest-change#bl=off;old=off;dl=1;lon=20;lat=10;zoom=3;"
    ],
    "available_countries_codes": ["EC", "CO", "CR"]
  }
]
```

#### Descripción de Campos

- **id**: Identificador único de la capa.
- **raster_filename**: Nombre del archivo `.tiff` (con extensión) en la carpeta `app/maps/layers/rasters`.
- **attributes_filename**: Nombre del archivo `.json` (con extensión) en la carpeta `app/maps/metadata/attributes/<language>/` con los atributos de la capa.
- **considerations_filename**: Nombre del archivo `.md` (con extensión) en la carpeta `app/maps/metadata/considerations/<language>/` con las consideraciones de la capa.
- **pixel_size**: Tamaño del pixel (en metros).
- **baseline**: Año base para comparación.
- **compared_against**: Año final de comparación.
- **references**: URLs de referencia.
- **available_countries_codes**: Lista de códigos ISO 3166-1 alpha-2 de países disponibles en la capa.

## Estructura de los archivos de metadatos

### Atributos de la capa

En los archivos `app/maps/metadata/attributes/<language>/*.json` se encuentran los atributos de la capa. Estructura:

```json
{
  "name": "Global Forest Watch",
  "alias": "GFW 2020-2023",
  "coverage": "Superficie terrestre global (excluyendo la Antártida y otras islas del Ártico)",
  "source": "Global Forest Watch, en colaboración con Nasa, Universidad de Maryland y Google",
  "resolution": "30 x 30 metros",
  "contentDate": "Datos entre 2000 y 2023",
  "updateFrequency": "Anual",
  "publishDate": "Enero 2024"
}
```

#### Descripción de Campos

- **name**: Nombre completo de la capa.
- **alias**: Nombre corto o referencia.
- **coverage**: Cobertura geográfica de la capa.
- **source**: Origen de la capa.
- **resolution**: Resolución espacial.
- **contentDate**: Período cubierto por los datos.
- **updateFrequency**: Frecuencia de actualización.
- **publishDate**: Fecha de publicación o lanzamiento de la capa.

### Consideraciones de la capa

En los archivos `app/maps/metadata/considerations/<language>/*.md` se encuentran las consideraciones de la capa en formato Markdown.

## Agregar una Nueva Capa

1. **Descargar el archivo raster:**

   - Guardar en `app/maps/layers/rasters` con el nombre definido en `raster_filename`.
   - Asegurarse que el archivo tenga extensión `.tif`.

2. **Actualizar `index.json`:**

   - Agregar un nuevo objeto JSON al listado, siguiendo la estructura descrita.

3. **Transformación de Datos (opcional):**

   - Si la capa provee años de deforestación en vez de valores binarios, transformar los valores mayores al año base en `1` para marcar deforestación.

4. **Validación:**
   - Verificar que el archivo raster sea legible y que los valores en el raster correspondan a los especificados en `deforestation_values`.

## Actualizar una Capa Existente

1. **Reemplazar el archivo raster:**

   - Subir el nuevo archivo `.tif` en `app/maps/layers/rasters`, reemplazando el anterior.

2. **Actualizar `index.json`:**

   - Modificar los campos necesarios, como `compared_against`, `contentDate`, `updateFrequency`.

3. **Verificación:**
   - Correr un análisis de prueba para confirmar que los cambios se reflejan correctamente.

## Pre-Procesamiento de Mapas Públicos

Algunos mapas públicos requieren un pre-procesamiento antes de ser utilizados en la aplicación. Los mapas **Global Forest Watch (GFW)** y **Tropical Moist Forests (TMF)** traen bandas con el año en el que ocurrió la deforestación. Se realiza un pre-procesamiento en Python que incluye:

- Clippear países específicos para reducir el tamaño de los archivos.
- Transformar a valores binarios donde los años mayores al año base se convierten en `1`.
- Descargar por secciones para mapas muy grandes.
- Mergear todo en un archivo consolidado y comprimirlo para reducir su tamaño.

A la fecha de publicación de la primera versión del código (mayo 2025), se han incluído datos para **Ecuador**, **Colombia** y **Costa Rica**.

- Para **GFW** se lee la banda `loss_year`, que indica el año en que ocurrió la pérdida forestal.
- Para **TMF** se lee el recurso `DeforestationYear`, que indica el año de la deforestación.

Los scripts Python utilizados en este pre-procesamiento utilizan la API de **Google Earth Engine**. Se pueden encontrar en la carpeta `scripts/update-gfw-tmf`.

## Consideraciones Finales

- **Integridad:** Asegurarse que el `id` de cada capa sea único.
- **Respaldo:** Antes de cualquier cambio, hacer un respaldo de `index.json` y los archivos `.tif`.
- **Pruebas:** Validar que la aplicación reconoce la nueva capa y realiza los cálculos correctamente.

Esta documentación asegura que el manejo de capas en la aplicación sea ordenado, replicable y compatible con futuras expansiones del sistema.


# Documentation for Layer/Map Management in the Deforestation Analysis Application (English)

## File Structure

- **Layer Index:** `app/maps/index.json`
- **Raster Layers:** `app/maps/layers/rasters/*.tif`
- **Layer Metadata:** `app/maps/metadata/attributes/<language>/*.json`
- **Layer Considerations:** `app/maps/metadata/considerations/<language>/*.md`

## Layer Index Structure

The file `app/maps/index.json` contains a list of JSON objects, each representing an analysis layer. Structure:

```json
[
  {
    "id": 0,
    "raster_filename": "gfw.tif",
    "attributes_filename": "gfw.json",
    "considerations_filename": "gfw.md",
    "pixel_size": 30,
    "baseline": "2020",
    "compared_against": "2023",
    "references": [
      "https://glad.earthengine.app/view/global-forest-change#bl=off;old=off;dl=1;lon=20;lat=10;zoom=3;"
    ],
    "available_countries_codes": ["EC", "CO", "CR"]
  }
]
```

#### Field Description

- **id**: Unique identifier of the layer.
- **raster_filename**: Name of the `.tiff` file (with extension) in the `app/maps/layers/rasters` folder.
- **attributes_filename**: Name of the `.json` file (with extension) in the `app/maps/metadata/attributes/<language>/` folder with the layer attributes.
- **considerations_filename**: Name of the `.md` file (with extension) in the `app/maps/metadata/considerations/<language>/` folder with the layer considerations.
- **pixel_size**: Pixel size (in meters).
- **baseline**: Base year for comparison.
- **compared_against**: Final comparison year.
- **references**: Reference URLs.
- **available_countries_codes**: List of ISO 3166-1 alpha-2 country codes available in the layer.

## Metadata File Structure

### Layer Attributes

In the files `app/maps/metadata/attributes/<language>/*.json` the layer attributes are found. Structure:

```json
{
  "name": "Global Forest Watch",
  "alias": "GFW 2020-2023",
  "coverage": "Global land surface (excluding Antarctica and other Arctic islands)",
  "source": "Global Forest Watch, in collaboration with NASA, University of Maryland, and Google",
  "resolution": "30 x 30 meters",
  "contentDate": "Data between 2000 and 2023",
  "updateFrequency": "Annual",
  "publishDate": "January 2024"
}
```

#### Field Description

- **name**: Full name of the layer.
- **alias**: Short name or reference.
- **coverage**: Geographical coverage of the layer.
- **source**: Origin of the layer.
- **resolution**: Spatial resolution.
- **contentDate**: Period covered by the data.
- **updateFrequency**: Update frequency.
- **publishDate**: Publication or release date of the layer.

### Layer Considerations

In the files `app/maps/metadata/considerations/<language>/*.md` the layer considerations are found in Markdown format.

## Adding a New Layer

1. **Download the raster file:**

   - Save in `app/maps/layers/rasters` with the name defined in `raster_filename`.
   - Ensure the file has a `.tif` extension.

2. **Update `index.json`:**

   - Add a new JSON object to the list, following the described structure.

3. **Data Transformation (optional):**

   - If the layer provides deforestation years instead of binary values, transform values greater than the base year to `1` to mark deforestation.

4. **Validation:**
   - Verify that the raster file is readable and that the values in the raster correspond to those specified in `deforestation_values`.

## Updating an Existing Layer

1. **Replace the raster file:**

   - Upload the new `.tif` file in `app/maps/layers/rasters`, replacing the previous one.

2. **Update `index.json`:**

   - Modify the necessary fields, such as `compared_against`, `contentDate`, `updateFrequency`.

3. **Verification:**
   - Run a test analysis to confirm that the changes are correctly reflected.

## Pre-Processing of Public Maps

Some public maps require pre-processing before being used in the application. The **Global Forest Watch (GFW)** and **Tropical Moist Forests (TMF)** maps bring bands with the year deforestation occurred. Pre-processing in Python includes:

- Clipping specific countries to reduce file size.
- Transforming to binary values where years greater than the base year are converted to `1`.
- Downloading in sections for very large maps.
- Merging everything into a consolidated file and compressing it to reduce its size.

By the time of publishing the first version of the code (may 2025), resources include data for **Ecuador**, **Colombia**, and **Costa Rica**.

- For **GFW** the `loss_year` band is read, indicating the year forest loss occurred.
- For **TMF** the `DeforestationYear` resource is read, indicating the year of deforestation.

The Python scripts used in this pre-processing utilize the **Google Earth Engine** API. They can be found in the `scripts/update-gfw-tmf` folder.

## Final Considerations

- **Integrity:** Ensure that the `id` of each layer is unique.
- **Backup:** Before any change, make a backup of `index.json` and the `.tif` files.
- **Testing:** Validate that the application recognizes the new layer and performs calculations correctly.

This documentation ensures that layer management in the application is orderly, replicable, and compatible with future system expansions. 