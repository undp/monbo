## Validación de polígonos

El módulo de validación de polígonos revisa que cada finca tenga una geometría correcta y que no se traslape con otra. Una finca con cualquiera de los problemas de esta sección queda marcada como **no válida**. Puedes revisarla en el mapa, corregirla en tu archivo o incluirla igual mediante la validación manual.

Esta validación es un **paso aparte y opcional**. Si cargas tu archivo directamente en el módulo de análisis de deforestación, no se ejecuta: las fincas no se comparan entre sí, así que un resultado de deforestación por sí solo no muestra que no se traslapen. Una finca con geometría inválida igual aparece ahí sin resultado (N/D).

### Qué geometrías se aceptan

- **Polígonos**, en formato WKT o GeoJSON. Un polígono puede tener **huecos** (por ejemplo, una laguna o una zona que no es parte de la finca) y puede estar formado por **varias partes** separadas (un MultiPolygon).
- **Puntos**, cuando solo se conoce la ubicación de la finca. Un punto toma la superficie declarada en la plantilla (ver [Superficie de las fincas](#area)).
- Las coordenadas son longitud y latitud en grados (WGS84, el sistema del GPS). La longitud va de −180 a 180 y la latitud de −90 a 90. Una fila con coordenadas fuera de esos rangos, o con otra geometría (una línea, por ejemplo), se rechaza al cargar el archivo.

### Geometrías inválidas

Un polígono es inválido cuando no describe una superficie bien definida:

- **Polígono vacío:** no tiene ningún punto.
- **Muy pocos puntos:** tiene menos de 3 puntos distintos, o todos están sobre una misma línea, así que no encierra ninguna superficie.

  ![Polígono con muy pocos puntos](/images/documentation/polygon_few_points_example.png)

- **Autointersección:** el borde se cruza consigo mismo, como un ocho o una corbata de moño. No queda claro qué parte está dentro de la finca.

  ![Polígono que se cruza consigo mismo](/images/documentation/polygon_self_intersection_example.png)

- **Hueco fuera de la finca:** un hueco que no está dentro del borde exterior de su parte.
- **Partes que se superponen:** dos partes de la misma finca que se pisan entre sí.

Una finca con geometría inválida no se compara con las demás para buscar traslapes, y en el análisis de deforestación aparece sin resultado (N/D).

### Traslapes entre fincas

Dos fincas se traslapan cuando comparten superficie. Ocurre cuando una misma tierra se declaró dos veces, o cuando los bordes de dos fincas vecinas se midieron con error.

![Dos fincas que se traslapan; en rojo, la superficie compartida](/images/documentation/polygon_overlap_example.png)

El porcentaje de traslape se mide contra la **finca más pequeña** de las dos:

```
traslape = superficie compartida / superficie de la finca más pequeña
```

Así, una finca de 1 ha que está completamente dentro de una de 200 ha tiene un traslape de 100%, no de 0,5%. Lo que importa es que toda la finca chica está declarada dos veces.

- Se informa un traslape solo cuando su porcentaje es **mayor que {{overlapThreshold}}**. Este umbral lo define cada instalación de Monbo.
- Un traslape mayor que **80%** se muestra en **rojo** (criticidad alta), y uno de hasta 80% en **naranjo** (criticidad media).
- Las dos fincas de un traslape informado quedan como no válidas.
- Dos fincas que solo comparten un borde o una esquina no se traslapan, porque no comparten superficie.
- Una finca que está dentro del hueco de otra no se traslapa con ella.
- Si una finca tiene varias partes, se compara con todas ellas. Su superficie total es la suma de sus partes.
- Una finca cargada como punto se compara como un círculo construido a partir de la superficie declarada, de forma aproximada (ver [Superficie de las fincas](#area)).

Si una finca se traslapa con varias, se informa un traslape por cada par.

[Detalle técnico de la validación (en inglés)](https://github.com/undp/monbo/blob/dev/apps/api/README.md#1-polygons-validation)
