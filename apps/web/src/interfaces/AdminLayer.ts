import type { components } from "@/api/schema";

// The API shapes are generated from its OpenAPI (`pnpm contracts`); only the
// admin form's helpers are written here. Field names follow the layers index.

export type AdminLanguage = "en" | "es";

export const ADMIN_LANGUAGES: AdminLanguage[] = ["es", "en"];

export type LayerAttributes = components["schemas"]["LayerAttributes"];

export type OptionalAttributeKey = Exclude<keyof LayerAttributes, "name" | "alias">;

export const OPTIONAL_ATTRIBUTE_KEYS: OptionalAttributeKey[] = [
  "coverage",
  "source",
  "resolution",
  "contentDate",
  "updateFrequency",
  "publishDate",
];

export type LayerInput = components["schemas"]["LayerInput"];
// A layer's attributes as stored, possibly incomplete; null for a language whose
// metadata file doesn't exist
export type StoredAttributes = components["schemas"]["StoredAttributes"];
export type AdminLayer = components["schemas"]["AdminLayer"];
export type AdminSession = components["schemas"]["SessionData"];

// Errors and warnings carry a stable code; the UI translates them by code.
export type JobIssue = components["schemas"]["JobIssue"];
export type RasterReport = components["schemas"]["RasterReport"];
export type IngestionJob = components["schemas"]["IngestionJob"];
export type JobStatus = IngestionJob["status"];
// While running: validating, then converting (conversion, verification, activation)
export type JobPhase = NonNullable<IngestionJob["phase"]>;
