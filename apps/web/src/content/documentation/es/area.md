## Superficie de las fincas

La superficie de cada finca es la que ves en hectáreas en las tablas y el reporte. Con ella se miden los traslapes, y decide si una finca se puede analizar por deforestación. El porcentaje de deforestación en sí no divide por esta superficie: compara dos superficies medidas sobre la capa de mapa (ver [Cálculo de la deforestación](#deforestation)).

### Polígonos

Monbo **calcula** la superficie de cada polígono a partir de sus coordenadas. La superficie declarada en la plantilla no se usa para los polígonos.

- La superficie se mide sobre el **elipsoide terrestre** (WGS84, el modelo de la Tierra que usa el GPS), sin pasar por una proyección de mapa. Un mapa plano deforma las superficies según la zona, mientras que el elipsoide da la superficie real del terreno en cualquier lugar, incluso en una finca que cruza la línea del ecuador.
- Se **restan los huecos**. Una finca de 10 ha con una laguna de 1 ha en su interior mide 9 ha.
- Se **suman las partes**. Una finca con dos partes separadas, de 9 ha y 5 ha, mide 14 ha.
- El orden en que se escribieron los puntos (en el sentido del reloj o al revés) no cambia el resultado.

Un polígono inválido (ver [Validación de polígonos](#validation)) no tiene una superficie bien definida. Por eso no recibe un porcentaje de deforestación.

### Puntos

Una finca cargada como punto no tiene borde, así que Monbo usa la **superficie declarada** en la plantilla, en hectáreas. Si la plantilla no la indica, se asume **1 ha**.

Para buscar traslapes y medir la deforestación, el punto se trata como un **círculo** centrado en esa ubicación, con esa superficie. Por ejemplo, un punto de 1 ha se analiza como un círculo de unos 56 m de radio.

[Detalle técnico del cálculo de superficie (en inglés)](https://github.com/undp/monbo/blob/dev/docs/polygon_area_calculation.md)
