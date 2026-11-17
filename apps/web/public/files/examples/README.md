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
asks for none (rasters pulled with `git lfs pull`).

Each farm sheet links its GeoJSON through the API's `/download-geojson`, so point that
link at a public API, never at the local one: a reader of the sample has no
`localhost`. `NEXT_PUBLIC_DOWNLOAD_GEOJSON_URL` overrides only that link; the rest of
the web keeps using the local API.

Today that is the dev environment's API, the only stable public one: if that
environment is recreated, the samples' GeoJSON links stop working. Once production has
a stable API URL, regenerate both samples with it (follow-up of #116).

```bash
# from apps/api
GCP_MAPS_PLATFORM_API_KEY= GCP_MAPS_PLATFORM_SIGNATURE_SECRET= uv run fastapi dev app/main.py
# from apps/web (the public API: today, the dev environment's)
NEXT_PUBLIC_MAX_REQUESTS_FOR_SATELLITE_BACKGROUND_AT_DEFORESTATION_IMAGE_GENERATION=1 \
NEXT_PUBLIC_DOWNLOAD_GEOJSON_URL=https://monbo-api.jollymoss-3d07235c.eastus2.azurecontainerapps.io/download-geojson \
pnpm dev
```

Then, for each language:

1. Open the start page in that language (`/` or `/en`), choose **Costa Rica** and press
   step 1.
2. Upload `ejemplo-fincas-con-coordenadas.xlsx` (or `example-farms-with-coordinates.xlsx`)
   in the Excel option and validate the polygons.
3. Press "Continuar" in the next-stage card, select every layer (GFW, TMF and MOCUPP)
   and continue.
4. In stage 2, press "Continuar", keep every polygon, select every layer and continue.
5. Press "Generar reporte", then "Descargar" and choose one PDF with every polygon.
6. Save the file as `es/ejemplo-reporte.pdf` (or `en/example-report.pdf`).
7. Check that no farm map has a satellite photo behind it (they show a plain dark
   green background) and that no page mentions Google Maps: the satellite caption is
   printed only when the maps have the satellite background.
8. Check that no link in the PDF points to `localhost` (open "Descargar GeoJSON" /
   "Download GeoJSON" on a farm sheet: it downloads that farm's GeoJSON).
