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
    excel: "ejemplo-fincas-con-coordenadas.xlsx",
    geojson: "ejemplo-fincas-con-datos.geojson",
    shapefile: "ejemplo-fincas-con-datos-shapefile.zip",
    kml: "ejemplo-fincas-por-id.kml",
    geoExcel: "ejemplo-datos-produccion-por-id.xlsx",
  },
  en: {
    excel: "example-farms-with-coordinates.xlsx",
    geojson: "example-farms-with-data.geojson",
    shapefile: "example-farms-with-data-shapefile.zip",
    kml: "example-farms-by-id.kml",
    geoExcel: "example-production-data-by-id.xlsx",
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
