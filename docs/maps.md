# Documentación del Manejo de Capas/Mapas en la Aplicación de Análisis de Deforestación

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
    ]
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
  "updateFrequency": "Anual"
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

En los recursos actuales se han incluído datos para **Ecuador**, **Colombia** y **Costa Rica**.

- Para **GFW** se lee la banda `loss_year`, que indica el año en que ocurrió la pérdida forestal.
- Para **TMF** se lee el recurso `DeforestationYear`, que indica el año de la deforestación.

Los scripts Python utilizados en este pre-procesamiento utilizan la API de **Google Earth Engine**. Se pueden encontrar en la carpeta `scripts/update-gfw-tmf`.

## Consideraciones Finales

- **Integridad:** Asegurarse que el `id` de cada capa sea único.
- **Respaldo:** Antes de cualquier cambio, hacer un respaldo de `index.json` y los archivos `.tif`.
- **Pruebas:** Validar que la aplicación reconoce la nueva capa y realiza los cálculos correctamente.

Esta documentación asegura que el manejo de capas en la aplicación sea ordenado, replicable y compatible con futuras expansiones del sistema.
