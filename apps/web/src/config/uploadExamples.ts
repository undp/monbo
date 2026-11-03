// Example files for each way to upload farms, in public/files/examples/{es,en}/.
// generate-upload-examples.py makes them; uploadExamples.test.ts uploads them.

interface UploadExamples {
  /** Option 1: the template filled in, with coordinates */
  excel: string;
  /** Option 2: geo files whose attributes carry the farms' data */
  geojson: string;
  shapefile: string;
  /** Option 3: a KML whose placemark names are the IDs, and its Excel */
  kml: string;
  geoExcel: string;
}

const FILES: Record<"es" | "en", UploadExamples> = {
  es: {
    excel: "opcion-1-plantilla-con-coordenadas.xlsx",
    geojson: "opcion-2-fincas.geojson",
    shapefile: "opcion-2-fincas-shapefile.zip",
    kml: "opcion-3-poligonos.kml",
    geoExcel: "opcion-3-datos-produccion.xlsx",
  },
  en: {
    excel: "option-1-template-with-coordinates.xlsx",
    geojson: "option-2-farms.geojson",
    shapefile: "option-2-farms-shapefile.zip",
    kml: "option-3-polygons.kml",
    geoExcel: "option-3-production-data.xlsx",
  },
};

/** The example files' paths in the user's language (Spanish by default). */
export const getUploadExamples = (locale: string): UploadExamples => {
  const language = locale === "en" ? "en" : "es";
  const files = FILES[language];
  return Object.fromEntries(
    Object.entries(files).map(([key, name]) => [
      key,
      `/files/examples/${language}/${name}`,
    ])
  ) as unknown as UploadExamples;
};
