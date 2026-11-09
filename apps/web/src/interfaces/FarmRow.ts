/**
 * One farm as the upload sends it to `/farms/parse`: the keys the Excel template's
 * headers map to (see `headerKeywordsMappings` in utils/excel.ts). Every source
 * (the Excel, a geo file, a geo file joined to an Excel, a farm added manually)
 * produces these rows, and the API validates them as `InputFarmData`.
 */
export type FarmRow = Record<string, unknown> & {
  id?: string | null;
  producerName?: string | null;
  // ISO date, as the Excel loader writes it
  productionDate?: string | null;
  productionQuantity?: number | string | null;
  productionQuantityUnit?: string | null;
  region?: string | null;
  association?: string | null;
  cropType?: string | null;
  coordinatesFormat?: "WKT" | "GeoJSON" | string | null;
  geometryType?: "Point" | "Polygon" | "MultiPolygon" | string | null;
  // WKT, or a GeoJSON coordinates array as text
  farmCoordinates?: string | null;
  // Hectares; the radius of a point farm comes from it
  area?: number | string | null;
  documents: { name: string; url: string }[];
};
