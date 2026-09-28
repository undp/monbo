// Mirrors monbo-api/app/modules/admin/models.py and the ingestion job JSON
// (app/modules/admin/ingestion.py). Field names follow the layers index.

export type AdminLanguage = "en" | "es";

export const ADMIN_LANGUAGES: AdminLanguage[] = ["es", "en"];

export interface LayerAttributes {
  name: string;
  alias: string;
  coverage?: string | null;
  source?: string | null;
  resolution?: string | null;
  contentDate?: string | null;
  updateFrequency?: string | null;
  publishDate?: string | null;
}

export type OptionalAttributeKey = Exclude<keyof LayerAttributes, "name" | "alias">;

export const OPTIONAL_ATTRIBUTE_KEYS: OptionalAttributeKey[] = [
  "coverage",
  "source",
  "resolution",
  "contentDate",
  "updateFrequency",
  "publishDate",
];

export interface LayerInput {
  pixel_size: number;
  baseline: number;
  compared_against: number;
  references: string[];
  available_countries_codes: string[];
  attributes: Record<AdminLanguage, LayerAttributes>;
  considerations: Record<AdminLanguage, string | null>;
}

export interface AdminLayer {
  id: number;
  pixel_size: number;
  baseline: number | null;
  compared_against: number | null;
  references: string[];
  available_countries_codes: string[];
  enabled: boolean;
  version: number;
  raster_filename: string | null;
  has_raster: boolean;
  // null when the metadata file for that language doesn't exist
  attributes: Record<AdminLanguage, Partial<LayerAttributes> | null>;
  considerations: Record<AdminLanguage, string | null>;
}

export interface AdminSession {
  token: string;
  expiresAt: string;
}

// Errors and warnings carry a stable code; the UI translates them by code.
export interface JobIssue {
  code: string;
  message: string;
  params: Record<string, unknown>;
}

export interface RasterReport {
  crs: string;
  width: number;
  height: number;
  bounds: number[];
  dtype: string;
  nodata: number | null;
  values: number[];
  approxResolutionM: number | null;
}

export type JobStatus = "queued" | "running" | "succeeded" | "failed";

export interface IngestionJob {
  jobId: string;
  layerId: number;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  requestedNodata: number | null;
  error: JobIssue | null;
  warnings: JobIssue[];
  report: RasterReport | null;
  rasterFilename: string | null;
  version: number | null;
}
