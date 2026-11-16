# Example files

The upload page offers these files as examples, and the start page links the sample
report. The farms are five coffee plots in Costa Rica.

| File (`es/` · `en/`) | What it is |
|---|---|
| `ejemplo-fincas-con-coordenadas.xlsx` · `example-farms-with-coordinates.xlsx` | Excel template filled in, with WKT/GeoJSON coordinates |
| `ejemplo-fincas-con-datos.geojson` · `example-farms-with-data.geojson` | Geographic file with the production data |
| `ejemplo-fincas-con-datos-shapefile.zip` · `example-farms-with-data-shapefile.zip` | The same, as a Shapefile |
| `ejemplo-fincas-por-id.kml` · `example-farms-by-id.kml` | Geometries only, joined by ID |
| `ejemplo-datos-produccion-por-id.xlsx` · `example-production-data-by-id.xlsx` | Production data for the KML, by ID |
| `ejemplo-reporte.pdf` · `example-report.pdf` | Sample report, opened from "Ver ejemplo de reporte" on the start page |

## Regenerating the sample report

The report is built by the app itself, so regenerate it whenever the report changes
(its cover, sections or layers).

It must be generated **without the satellite background**: the farm maps then use the
solid background, with no Google Maps imagery, whose terms restrict storing it and
serving it from a public repository as a static file. Start the API without the Maps key
and the web with a satellite limit below the number of farms (5), so that the report
asks for none (rasters pulled with `git lfs pull`):

```bash
# from apps/api
GCP_MAPS_PLATFORM_API_KEY= GCP_MAPS_PLATFORM_SIGNATURE_SECRET= uv run fastapi dev app/main.py
# from apps/web
NEXT_PUBLIC_MAX_REQUESTS_FOR_SATELLITE_BACKGROUND_AT_DEFORESTATION_IMAGE_GENERATION=1 pnpm dev
```

Then, for each language:

1. Open the start page in that language (`/` or `/en`), choose **Costa Rica** and press
   step 1.
2. Upload `ejemplo-fincas-con-coordenadas.xlsx` (or `example-farms-with-coordinates.xlsx`)
   in the Excel option and validate the polygons.
3. Press "Analizar Deforestación", select every layer (GFW, TMF and MOCUPP) and continue.
4. Press "Preparar reporte", keep every polygon, select every layer and continue.
5. Press "Generar reporte" and then "Descargar" (one PDF with every polygon).
6. Save the file as `es/ejemplo-reporte.pdf` (or `en/example-report.pdf`).
7. Check that no farm map has a satellite photo behind it (they show a plain dark
   green background). The caption under each map still mentions Google Maps
   imagery until GC-7 shows it only with the satellite background (#116).
