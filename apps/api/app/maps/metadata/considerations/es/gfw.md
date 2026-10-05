### Definiciones y Limitaciones de los Datos

- Definición de bosque: GFW usa la definición de la Universidad de Maryland (UMD), que considera bosques como áreas con un dosel de al menos 30% y árboles de más de 5 metros de altura. Esto puede no coincidir con definiciones legales o ecológicas en algunos países.
- Deforestación ≠ conversión de uso de suelo: La pérdida de cobertura arbórea detectada no siempre implica conversión permanente, ya que incluye tala selectiva, incendios temporales y otros disturbios naturales o humanos.
- No distingue causas de deforestación: GFW detecta pérdida de bosque, pero no diferencia entre agricultura, incendios, minería, urbanización u otros factores sin un análisis complementario.

### Datos Satelitales Utilizados

- Imágenes Landsat (NASA/USGS) con resolución de 30 metros.
- Sentinel-2 (ESA) para alertas de mayor precisión.
- Datos de radar como GEDI (NASA) y Radar de Apertura Sintética (SAR).

### Detección de Pérdida y Ganancia de Bosque

- Pérdida de bosque: Se refiere a la eliminación completa de la cobertura arbórea con base en el modelo de la Universidad de Maryland (UMD) liderado por Matthew Hansen.
- Ganancia de bosque: Representa áreas donde la cobertura forestal se ha expandido.
- Alertas de deforestación en tiempo casi real:
- GLAD (UMD): Detecta cambios semanales con Landsat y Sentinel-2.
- RADD (Wageningen University): Alertas específicas para los trópicos con datos de radar.

### Algoritmos de análisis

- Modelos de aprendizaje automático para diferenciar entre deforestación natural y causada por el hombre.
- Comparación de imágenes satelitales de diferentes fechas para identificar cambios abruptos.
- Filtros de corrección para evitar falsas alarmas debido a nubes o errores de sensor.

### Validación y Refinamiento

- Los datos son validados con estudios de campo, imágenes de mayor resolución y otros conjuntos de datos (ej. GEDI de la NASA para estructura de bosque).
- Se integran fuentes adicionales como FIRMS de NASA para monitorear incendios forestales.

### Temporalidad y Actualización

- Alertas de deforestación (GLAD, RADD): Se generan semanalmente o cada pocos días, pero pueden requerir validación adicional.
- Mapas anuales de pérdida de bosque: Se actualizan cada año con datos históricos desde el 2000, pero tienen un rezago de varios meses.
- Datos de incendios y degradación: Se deben complementar con información de sistemas como FIRMS de NASA.
