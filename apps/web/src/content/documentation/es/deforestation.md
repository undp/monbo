## Cálculo de la deforestación

Para cada finca y cada capa de mapa elegida, Monbo calcula **qué porcentaje de la superficie de la finca está sobre zonas donde se perdió bosque**.

### Las capas de mapas

Una capa de mapa divide el territorio en una cuadrícula de **píxeles**: cuadrados de 30 × 30 m en la mayoría de las capas (10 × 10 m en algunas, como las de Costa Rica). La capa marca cada píxel donde se perdió bosque entre su año base y su año de comparación. La fuente, la resolución y las fechas de cada capa están en **Detalles de mapas**, en el módulo de análisis de deforestación.

### El porcentaje

```
deforestación = superficie de la finca sobre píxeles con pérdida / superficie de la finca
```

Cada píxel con pérdida **cuenta solo por la parte que queda dentro de la finca**. Si el borde de la finca cubre un tercio de un píxel con pérdida, ese píxel suma un tercio de su superficie, no el píxel entero. Así, el porcentaje nunca supera 100%, y un píxel que la finca apenas roza en su borde no la hace aparecer como deforestada.

Si la finca tiene huecos, la pérdida dentro de un hueco no cuenta. Si tiene varias partes, se suma la pérdida de todas y se divide por su superficie total (ver [Superficie de las fincas](#area)). Cada finca recibe un solo porcentaje por capa.

### Un ejemplo

Una finca de 1 ha (10.000 m²), sobre una capa de píxeles de 30 m (900 m² cada uno):

- cubre por completo 2 píxeles con pérdida: 2 × 900 = 1.800 m²;
- su borde cruza un tercer píxel con pérdida y deja dentro de la finca 300 m² de él.

```
deforestación = (1.800 + 300) / 10.000 = 21%
```

### El umbral

Una finca cuyo porcentaje es **mayor que {{deforestationThreshold}}** se muestra con deforestación en esa capa. Si su porcentaje es igual o menor, se muestra como **libre de deforestación**. Este umbral lo define cada instalación de Monbo.

### Fincas sin resultado

Una finca aparece **sin resultado (N/D)** en una capa, en lugar de 0%, cuando no se puede medir:

- su polígono es inválido o está vacío (ver [Validación de polígonos](#validation));
- su superficie es 0;
- está completamente fuera de la zona que cubre la capa;
- la capa no se pudo leer en ese momento.

Una finca sin resultado no afecta los resultados de las demás.

### El límite del método

La precisión llega hasta el píxel. Cuando una capa marca un píxel con pérdida, todo el píxel se considera bosque perdido. El cálculo reparte cada píxel exactamente entre la finca y su entorno, pero no puede saber en qué parte del píxel ocurrió la pérdida. Esa precisión depende de la resolución de cada capa, no del cálculo.

Cada capa usa además su propia definición de bosque y sus propias fechas. Por eso, una misma finca puede tener porcentajes distintos en capas distintas.

[Detalle técnico del cálculo de deforestación (en inglés)](https://github.com/undp/monbo/blob/dev/docs/deforestation_calculation.md)
