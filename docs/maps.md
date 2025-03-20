# Documentación del Manejo de Capas/Mapas en la Aplicación de Análisis de Deforestación

## Estructura de Archivos

- **Metadata de Capas:** `app/maps.json`
- **Capas Raster:** `app/map_assets/*.tif`

## Pre-Procesamiento de Mapas Públicos

Algunos mapas públicos requieren un pre-procesamiento antes de ser utilizados en la aplicación. Los mapas **Global Forest Watch (GFW)** y **Tropical Moist Forests (TMF)** traen bandas con el año en el que ocurrió la deforestación. Se realiza un pre-procesamiento en Python que incluye:

- Clippear países específicos para reducir el tamaño de los archivos.
- Transformar a valores binarios donde los años mayores al año base se convierten en `1`.
- Descargar por secciones para mapas muy grandes.
- Mergear todo en un archivo consolidado y comprimirlo para reducir su tamaño.

En los recursos actuales se han incluído datos para **Ecuador**, **Colombia** y **Costa Rica**.

- Para **GFW** se lee la banda `loss_year`, que indica el año en que ocurrió la pérdida forestal.
- Para **TMF** se lee el recurso `DeforestationYear`, que indica el año de la deforestación.

Los scripts Python utilizados en este pre-procesamiento utilizan la API de **Google Earth Engine**. Se adjuntan como anexos en esta documentación.

## Estructura de Metadata

El archivo `maps.json` contiene un listado de objetos JSON, cada uno representando una capa de análisis. Estructura:

```json
{
  "id": 0,
  "name": "Global Forest Watch",
  "alias": "GFW 2020-2023",
  "asset": {
    "name": "gfw",
    "deforestation_values": [1],
    "pixel_size": 30,
    "baseline": "2020",
    "compared_against": "2023",
    "coverage": "Superficie terrestre global (excluyendo la Antártida y otras islas del Ártico)",
    "details": "Global Forest Watch, en colaboración con Nasa, Universidad de Maryland y Google",
    "resolution": "30 x 30 metros",
    "contentDate": "Cambio forestal mundial entre 2000 y 2023",
    "updateFrequency": "Anual",
    "source": "https://glad.earthengine.app/view/global-forest-change",
    "disclaimer": "TBD"
  }
}
```

### Descripción de Campos

- **id**: Identificador único de la capa.
- **name**: Nombre completo de la capa.
- **alias**: Nombre corto o referencia.
- **asset**: Información detallada:
  - **name**: Nombre interno del archivo `.tiff` (sin extensión).
  - **deforestation_values**: Lista de valores que indican deforestación en el raster.
  - **pixel_size**: Tamaño del pixel (en metros).
  - **baseline**: Año base para comparación.
  - **compared_against**: Año final de comparación.
  - **coverage**: Cobertura geográfica de la capa.
  - **details**: Descripción detallada de la fuente.
  - **resolution**: Resolución espacial.
  - **contentDate**: Período cubierto por los datos.
  - **updateFrequency**: Frecuencia de actualización.
  - **source**: URL de referencia.
  - **disclaimer**: Aviso legal o términos de uso.

## Agregar una Nueva Capa

1. **Descargar el archivo raster:**

   - Guardar en `app/map_assets/` con el nombre definido en `asset.name`.
   - Asegurarse que el archivo tenga extensión `.tif`.

2. **Actualizar `maps.json`:**

   - Agregar un nuevo objeto JSON al listado, siguiendo la estructura descrita.

3. **Transformación de Datos (opcional):**

   - Si la capa provee años de deforestación en vez de valores binarios, transformar los valores mayores al año base en `1` para marcar deforestación.

4. **Validación:**
   - Verificar que el archivo raster sea legible y que los valores en el raster correspondan a los especificados en `deforestation_values`.

## Actualizar una Capa Existente

1. **Reemplazar el archivo raster:**

   - Subir el nuevo archivo `.tif` en `app/map_assets/`, reemplazando el anterior.

2. **Actualizar `maps.json`:**

   - Modificar los campos necesarios, como `compared_against`, `contentDate`, `updateFrequency`.

3. **Verificación:**
   - Correr un análisis de prueba para confirmar que los cambios se reflejan correctamente.

## Consideraciones Finales

- **Integridad:** Asegurarse que el `id` de cada capa sea único.
- **Respaldo:** Antes de cualquier cambio, hacer un respaldo de `maps.json` y los archivos `.tif`.
- **Pruebas:** Validar que la aplicación reconoce la nueva capa y realiza los cálculos correctamente.

Esta documentación asegura que el manejo de capas en la aplicación sea ordenado, replicable y compatible con futuras expansiones del sistema.
