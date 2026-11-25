## Superficie de las fincas

:::summary
- La superficie de un polígono se **calcula** a partir de sus coordenadas, sobre la forma real de la Tierra.
- Un punto usa la **superficie declarada**.
- Es la superficie en hectáreas de las tablas y del reporte, y con ella se miden los traslapes.
:::

### ¿Cómo se calcula la superficie de un polígono?

A partir de sus coordenadas, no de la superficie declarada. Se mide sobre el **elipsoide terrestre** (WGS84, el modelo de la Tierra del GPS), sin pasar por un mapa plano, que deformaría las superficies según la zona. El cálculo suma, por cada lado del borde, la superficie entre ese lado y el ecuador: la misma idea que la fórmula de Gauss (ver [Cálculo de la deforestación](#deforestation)), sobre la Tierra curva.

Se **restan los huecos** y se **suman las partes**: una finca de 10 ha con una laguna de 1 ha mide 9 ha.

### ¿Y la superficie de un punto?

Usa la **superficie declarada** (ver [Carga de las fincas](#upload)). Para traslapes y deforestación se trata como un **círculo** con esa superficie: un punto de 1 ha recibe un radio de unos 56 m.

:::details[Más detalle: polígonos inválidos, el círculo de un punto y el porcentaje de deforestación]
- Un polígono inválido (ver [Validación de polígonos](#validation)) no tiene superficie, así que no recibe un porcentaje de deforestación.
- Las tablas y el reporte muestran la superficie declarada del punto, no la del círculo.
- El orden en que se escribieron los puntos del borde (en el sentido del reloj o al revés) no cambia el resultado.
- El círculo de un punto es una **aproximación** de la superficie declarada. Se dibuja en grados de latitud y longitud, y un grado de longitud cubre menos terreno mientras más lejos se está del ecuador. Por eso el círculo queda más angosto de este a oeste y cubre algo menos de terreno que el declarado: 1,5% menos a 10° de latitud y 13% menos a 30°.
- El porcentaje de deforestación no divide por esta superficie. Compara dos superficies medidas sobre la propia capa de mapa (ver [Cálculo de la deforestación](#deforestation)). Esta superficie solo decide si la finca se puede analizar.
:::

[Detalle técnico del cálculo de superficie (en inglés)](https://github.com/undp/monbo/blob/dev/docs/polygon_area_calculation.md)
