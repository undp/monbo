## Cálculo de la deforestación

:::summary
- Para cada finca y capa de mapa, Monbo calcula **qué porcentaje de la finca está sobre zonas con pérdida de bosque**.
- Un píxel que la finca cubre solo en parte cuenta solo por esa parte.
- Una finca **sobre {{deforestationThreshold}}** se muestra con deforestación en esa capa.
:::

### ¿Qué es una capa de mapa?

Una cuadrícula de **píxeles** de 30 × 30 m (10 × 10 m en algunas capas) que marca dónde se perdió bosque entre dos años. Sus fuentes y fechas están en **Detalles de mapas**.

### ¿Cómo se calcula el porcentaje?

```
deforestación = superficie de la finca sobre píxeles con pérdida / superficie de la finca
```

Cada píxel con pérdida **cuenta solo por la parte que queda dentro de la finca**. Así, un píxel que la finca apenas roza no la hace aparecer como deforestada.

Por ejemplo, una finca de 1 ha (10.000 m²) sobre píxeles de 30 m (900 m²) cubre entera 2 píxeles con pérdida, y su borde deja dentro 300 m² de un tercero:

![Un píxel con pérdida de 900 m² cortado por el borde de la finca: dentro de la finca quedan 300 m²](/images/documentation/loss_pixel_partial.svg)

```
deforestación = (2 × 900 + 300) / 10.000 = 21%
```

Sobre {{deforestationThreshold}}, la finca se muestra con deforestación en esa capa; con {{deforestationThreshold}} o menos, como **libre de deforestación**.

### ¿Cómo se mide cada superficie?

Cada trozo de píxel dentro de la finca, y la finca misma, es un polígono definido por sus esquinas. Su superficie se calcula con la **fórmula del área de Gauss** (o del cordón de zapato):

```
A = ½ · | Σ (xᵢ · yᵢ₊₁ − xᵢ₊₁ · yᵢ) |
```

Se recorren las esquinas en orden. Cada lado forma un triángulo con el origen (0, 0), que suma si el lado avanza en un sentido y resta si vuelve en el otro. Lo que queda fuera del polígono se suma y se resta, así que se anula: solo queda la superficie de adentro. Por eso sirve para cualquier forma, como el trozo irregular de un píxel cortado.

![El trozo de 300 m² dividido en los triángulos que forman sus lados con el origen: 75 m² y 225 m²](/images/documentation/gauss_area_formula.svg)

### ¿Por qué aparece N/D?

Una finca queda **sin resultado (N/D)**, en lugar de 0%, cuando no se puede medir:

- su polígono es inválido o está vacío (ver [Validación de polígonos](#validation));
- su superficie es 0;
- está completamente fuera de la zona que cubre la capa;
- la capa no se pudo leer en ese momento.

En el mapa del análisis aparece, por ahora, en la pestaña **Libre Def.** con N/D. No es un resultado libre de deforestación: no se pudo medir.

:::details[Más detalle: la fórmula de Gauss paso a paso]
El trozo de 300 m² del ejemplo tiene sus esquinas en (0, 0), (30, 0), (30, 5) y (0, 15), en metros. Cada lado aporta un término:

```
lado                xᵢ · yᵢ₊₁ − xᵢ₊₁ · yᵢ
(0, 0)  → (30, 0)    0 · 0  − 30 · 0  =   0
(30, 0) → (30, 5)   30 · 5  − 30 · 0  = 150
(30, 5) → (0, 15)   30 · 15 −  0 · 5  = 450
(0, 15) → (0, 0)     0 · 0  −  0 · 15 =   0
                                 suma = 600

A = ½ · 600 = 300 m²
```

Los dos lados que pasan por el origen no forman triángulo y suman 0. Los otros dos dan los triángulos del dibujo: ½ · 150 = 75 m² y ½ · 450 = 225 m². La superficie de la finca se calcula igual, con todas sus esquinas.
:::

:::details[Más detalle: el límite del método]
La precisión llega hasta el píxel. Si una capa marca un píxel con pérdida, todo el píxel cuenta como bosque perdido: el cálculo reparte cada píxel exactamente entre la finca y su entorno, pero no puede saber en qué parte del píxel ocurrió la pérdida. Esa precisión depende de la resolución de cada capa, no del cálculo.

Cada capa tiene además su propia definición de bosque y sus propias fechas, así que una misma finca puede tener porcentajes distintos en capas distintas.
:::

:::details[Más detalle: huecos, varias partes y coordenadas de la capa]
- Si la finca tiene huecos, la pérdida dentro de un hueco no cuenta. Si tiene varias partes, se suma la pérdida de todas y se divide por su superficie total. Cada finca recibe un solo porcentaje por capa.
- Una finca sin resultado no afecta los resultados de las demás.
- Las dos superficies se miden sobre la propia capa, en sus coordenadas, no con las hectáreas de las tablas (ver [Superficie de las fincas](#area)). Algunas capas están en metros y otras en grados de latitud y longitud. En grados, un grado de longitud cubre menos terreno lejos del ecuador, pero al tamaño de una finca esa deformación afecta por igual a las dos superficies del porcentaje, así que se cancela al dividir. La proporción es la misma que sobre el terreno.
:::

[Detalle técnico del cálculo de deforestación (en inglés)](https://github.com/undp/monbo/blob/dev/docs/deforestation_calculation.md)
