### Data Definitions and Limitations

- Forest definition: GFW uses the University of Maryland (UMD) definition, which considers forests as areas with at least 30% canopy cover and trees taller than 5 meters. This may not align with legal or ecological definitions in some countries.
- Deforestation ≠ land use conversion: Detected tree cover loss doesn't always imply permanent conversion, as it includes selective logging, temporary fires, and other natural or human disturbances.
- Does not distinguish causes of deforestation: GFW detects forest loss but doesn't differentiate between agriculture, fires, mining, urbanization, or other factors without complementary analysis.

### Satellite Data Used

- Landsat imagery (NASA/USGS) with 30-meter resolution.
- Sentinel-2 (ESA) for higher precision alerts.
- Radar data such as GEDI (NASA) and Synthetic Aperture Radar (SAR).

### Forest Loss and Gain Detection

- Forest loss: Refers to complete removal of tree cover based on the University of Maryland (UMD) model led by Matthew Hansen.
- Forest gain: Represents areas where forest cover has expanded.
- Near real-time deforestation alerts:
- GLAD (UMD): Detects weekly changes using Landsat and Sentinel-2.
- RADD (Wageningen University): Specific alerts for the tropics using radar data.

### Analysis Algorithms

- Machine learning models to differentiate between natural and human-caused deforestation.
- Comparison of satellite images from different dates to identify abrupt changes.
- Correction filters to avoid false alarms due to clouds or sensor errors.

### Validation and Refinement

- Data is validated with field studies, higher resolution imagery, and other datasets (e.g., NASA's GEDI for forest structure).
- Additional sources like NASA's FIRMS are integrated to monitor forest fires.

### Temporality and Updates

- Deforestation alerts (GLAD, RADD): Generated weekly or every few days, but may require additional validation.
- Annual forest loss maps: Updated yearly with historical data since 2000, but have a lag of several months.
- Fire and degradation data: Should be complemented with information from systems like NASA's FIRMS.
