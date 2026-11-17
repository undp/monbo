## Categorías de capas

:::summary
- Cada país agrupa sus capas en **categorías**, como Deforestación, Áreas protegidas o Frontera agrícola.
- La categoría dice qué cuenta como **observación**: coincidir con la capa o quedar fuera de ella.
- Una finca tiene observaciones cuando supera el **umbral** de su categoría.
:::

Cada categoría tiene nombre, ícono, color, umbral y los textos de sus dos resultados, y marca una de dos cosas:

- **Lo que se debe evitar** (pérdida de bosque, áreas protegidas): la observación es el porcentaje de la finca que coincide con la capa.
- **Lo permitido** (frontera agrícola): la observación es lo que queda fuera, el 100% menos el porcentaje que coincide.

### ¿Cuándo una finca tiene observaciones?

Cuando su observación supera el umbral de la categoría. Si no, queda **sin observaciones**, con el texto de resultado de la categoría, como "Libre de deforestación". Una categoría sin umbral propio usa el general, {{deforestationThreshold}}. Una finca **sin dato** (N/D) no queda ni con ni sin observaciones (ver [Cómo calculamos](#calculation)).

Las categorías y los umbrales de cada país están en [Capas por país](#layers).

:::details[Más detalle: la misma finca en las dos categorías]
Una finca coincide en un 30% con una capa, y la categoría tiene umbral 0%:

```
lo que se debe evitar:  observación = 30%             → con observaciones
lo permitido:           observación = 100% − 30% = 70% → con observaciones
```

Si la finca coincidiera en un 100%, en la primera tendría una observación de 100% y en la segunda de 0%: quedaría sin observaciones solo en la segunda.
:::
