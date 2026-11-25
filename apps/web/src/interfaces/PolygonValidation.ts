import type { components } from "@/api/schema";

// Generated from the API's OpenAPI (`pnpm contracts`); don't edit the shapes here.
export type OverlapData = components["schemas"]["OverlapData"];
export type ValidateFarmsResponse = components["schemas"]["PolygonInconsistenciesResponse"];
// Discriminated on `type`: overlap, invalid_geometry or empty_polygon
export type InconsistentPolygonData = ValidateFarmsResponse["inconsistencies"][number];

export type FarmValidationStatus = components["schemas"]["FarmResult"]["status"];

export const FarmValidationStatus = {
  VALID: "VALID",
  VALID_MANUALLY: "VALID_MANUALLY",
  NOT_VALID: "NOT_VALID",
} as const satisfies Record<FarmValidationStatus, FarmValidationStatus>;
