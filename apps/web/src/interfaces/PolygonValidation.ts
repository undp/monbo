import { FarmData } from "./Farm";
import { Coordinates } from "./Map";

export interface OverlapData {
  area: number;
  percentage: number;
  criticality: "HIGH" | "MEDIUM";
  paths: Coordinates[][];
  center: Coordinates;
}

interface InvalidGeometryInconsistencyData {
  reason: string;
}

export type InconsistentPolygonData =
  | {
      type: "overlap";
      farmIds: FarmData["id"][];
      data: OverlapData;
    }
  | {
      type: "invalid_geometry";
      farmIds: FarmData["id"][];
      data: InvalidGeometryInconsistencyData;
    };

export enum FarmValidationStatus {
  VALID = "VALID",
  VALID_MANUALLY = "VALID_MANUALLY",
  NOT_VALID = "NOT_VALID",
}

export interface ValidateFarmsResponse {
  farmResults: {
    farmId: string;
    status: FarmValidationStatus;
  }[];
  inconsistencies: InconsistentPolygonData[];
}
