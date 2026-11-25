## Validación de polígonos

:::summary
- Revisa que cada finca tenga una geometría correcta y que no se traslape con otra.
- Una finca con algún problema queda **no válida**: puedes corregirla o incluirla igual con la validación manual.
- Es un paso **opcional**: un resultado de deforestación no muestra que las fincas no se traslapen.
:::

Si cargas las fincas directamente en el análisis de deforestación, no se buscan traslapes. Las geometrías aceptadas están en [Carga de las fincas](#upload).

### ¿Por qué mi finca aparece como no válida?

Porque su geometría es inválida o porque se traslapa con otra finca. Las geometrías inválidas son:

- **Vacío:** no tiene ningún punto.
- **Muy pocos puntos:** menos de 3 puntos distintos, o todos sobre una misma línea.

  ![Polígono con muy pocos puntos](/images/documentation/polygon_few_points_example.png)

- **Autointersección:** el borde se cruza consigo mismo, como un ocho.

  ![Polígono que se cruza consigo mismo](/images/documentation/polygon_self_intersection_example.png)

- **Hueco fuera de la finca:** un hueco que no está dentro del borde de su parte.
- **Partes que se superponen:** dos partes de la misma finca que se pisan entre sí.

### ¿Cómo se mide un traslape?

Dos fincas se traslapan cuando comparten superficie: tierra declarada dos veces, o bordes medidos con error.

![Dos fincas que se traslapan; en rojo, la superficie compartida](/images/documentation/polygon_overlap_example.png)

El porcentaje se mide contra la **finca más pequeña**:

```
traslape = superficie compartida / superficie de la finca más pequeña
```

Una finca de 1 ha entera dentro de una de 200 ha tiene un traslape de 100%, no de 0,5%: toda la finca chica está declarada dos veces.

- Se informa un traslape solo si es **mayor que {{overlapThreshold}}**. Este umbral lo define cada instalación de Monbo.
- Sobre **80%** se muestra en **rojo** (criticidad alta); hasta 80%, en **naranjo** (criticidad media).
- Las dos fincas de un traslape informado quedan no válidas.

:::details[Más detalle: bordes, huecos, varias partes y puntos]
- Una finca con geometría inválida no se compara con las demás, y en el análisis de deforestación queda sin resultado (N/D).
- Dos fincas que solo comparten un borde o una esquina no se traslapan: no comparten superficie.
- Una finca que está dentro del hueco de otra no se traslapa con ella.
- Si una finca tiene varias partes, se compara con todas. Su superficie es la suma de sus partes.
- Un punto se compara como un círculo construido a partir de su superficie declarada, de forma aproximada (ver [Superficie de las fincas](#area)).
- Si una finca se traslapa con varias, se informa un traslape por cada par.
:::

[Detalle técnico de la validación (en inglés)](https://github.com/undp/monbo/blob/dev/apps/api/README.md#1-polygons-validation)
