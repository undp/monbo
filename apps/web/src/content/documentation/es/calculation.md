## Cómo calculamos

:::summary
- Cada polígono se cruza con cada capa. El resultado es **qué porcentaje de su superficie coincide con la capa**.
- Un píxel que el polígono cubre solo en parte cuenta solo por esa parte.
- La categoría de la capa dice si ese porcentaje es una observación (ver [Categorías de capas](#categories)).
:::

### ¿Qué es una capa?

Una cuadrícula de **píxeles**, por ejemplo de 30 × 30 m, en la que cada píxel marca o no lo que la capa representa: pérdida de bosque, un área protegida o la frontera agrícola. Las capas de cada país, con sus fuentes, fechas y resolución, están en [Capas por país](#layers).

### ¿Cómo se calcula el porcentaje?

```
% del polígono = área que coincide con la capa / área total del polígono × 100
```

Cada píxel marcado **cuenta solo por la parte que queda dentro del polígono**.

Por ejemplo, en una capa de deforestación, una finca de 1 ha (10.000 m²) sobre píxeles de 30 m (900 m²) cubre entera 2 píxeles con pérdida, y su borde deja dentro 300 m² de un tercero:

![Un píxel con pérdida de 900 m² cortado por el borde de la finca: dentro de la finca quedan 300 m²](/images/documentation/loss_pixel_partial.svg)

```
% de la finca = (2 × 900 + 300) / 10.000 × 100 = 21%
```

En una categoría como Deforestación, una finca sobre el umbral de su categoría se muestra con deforestación en esa capa; con el umbral o menos, como **libre de deforestación**. El umbral de cada categoría está en [Capas por país](#layers); si una categoría no tiene uno propio, se usa el general, {{deforestationThreshold}}.

### ¿Cómo se mide cada superficie?

Cada trozo de píxel dentro del polígono, y el polígono mismo, es un polígono definido por sus esquinas. Su superficie se calcula con la **fórmula del área de Gauss** (o del cordón de zapato):

```
A = ½ · | Σ (xᵢ · yᵢ₊₁ − xᵢ₊₁ · yᵢ) |
```

Se recorren las esquinas en orden. Cada lado forma un triángulo con el origen (0, 0), que suma si el lado avanza en un sentido y resta si vuelve en el otro. Lo que queda fuera del polígono se suma y se resta, así que se anula: solo queda la superficie de adentro. Por eso sirve para cualquier forma, como el trozo irregular de un píxel cortado.

![El trozo de 300 m² dividido en los triángulos que forman sus lados con el origen: 75 m² y 225 m²](/images/documentation/gauss_area_formula.svg)

### ¿Por qué aparece N/D?

Una finca queda **sin dato (N/D)**, en lugar de 0%, cuando no se puede medir:

- su polígono es inválido o está vacío (ver [Validación de polígonos](#validation));
- su superficie es 0;
- está completamente fuera de la zona que cubre la capa;
- la capa no se pudo leer en ese momento.

En el mapa del análisis aparece en su propia pestaña, **Sin dato**, con N/D, y no suma en el contador de fincas sin observaciones. No es un resultado sin observaciones: no se pudo medir.

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

Los dos lados que pasan por el origen no forman triángulo y suman 0. Los otros dos dan los triángulos del dibujo: ½ · 150 = 75 m² y ½ · 450 = 225 m². La superficie de la finca se calcula igual, un contorno cerrado a la vez: la fórmula da la superficie del borde exterior de cada parte y la de cada hueco, los huecos se restan de su parte y las partes se suman. Una finca de 10 ha con un hueco de 1 ha mide 9 ha.
:::

:::details[Más detalle: el límite del método]
La precisión llega hasta el píxel. Si una capa marca un píxel, todo el píxel cuenta como marcado: el cálculo reparte cada píxel exactamente entre la finca y su entorno, pero no puede saber en qué parte del píxel está, por ejemplo, la pérdida de bosque. Esa precisión depende de la resolución de cada capa, no del cálculo.

Cada capa tiene además sus propias definiciones y fechas, así que una misma finca puede tener porcentajes distintos en capas distintas. Los alcances de cada capa están en [Alcances y límites](#limits).
:::

:::details[Más detalle: cómo se escriben los porcentajes]
El informe y las tablas redondean cada porcentaje y, en algunos casos, lo escriben con un signo en lugar de la cifra. Cada texto dice si la finca cuenta como finca con observaciones en esa capa:

- **< X%**, donde X es el umbral de la categoría: la observación está en el umbral o por debajo. La finca cuenta como sin observaciones en esa capa y no se muestra la cifra exacta.
- **> X%**: la observación supera el umbral, pero al redondear queda en el umbral. Cuenta como observación.
- **< 0,1%**: el umbral de la categoría es 0 y la observación es mayor que 0, pero al redondear queda en 0. Cuenta como observación.
- **> 99,9%**: la observación es menor que 100%, pero al redondear queda en 100%.
- **0%**: nada de la finca es una observación.
:::

:::details[Más detalle: huecos, varias partes y coordenadas de la capa]
- Si la finca tiene huecos, lo que la capa marca dentro de un hueco no cuenta. Si tiene varias partes, se suma lo que coincide en todas y se divide por su superficie total. Cada finca recibe un solo porcentaje por capa.
- Una finca sin resultado no afecta los resultados de las demás.
- Las dos superficies se miden sobre la propia capa, en sus coordenadas, no con las hectáreas de las tablas (ver [Superficie de las fincas](#area)). Algunas capas están en metros y otras en grados de latitud y longitud. En grados, un grado de longitud cubre menos terreno lejos del ecuador, pero al tamaño de una finca esa deformación afecta por igual a las dos superficies del porcentaje, así que se cancela al dividir. La proporción es la misma que sobre el terreno.
:::

[Detalle técnico del cálculo (en inglés)](https://github.com/undp/monbo/blob/dev/docs/deforestation_calculation.md)
