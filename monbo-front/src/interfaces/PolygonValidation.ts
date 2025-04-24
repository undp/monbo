import { FarmData } from "./Farm";
import { Coordinates } from "./Map";

export interface InconsistentPolygonData {
  type: "overlap" | "duplicate";
  farmIds: FarmData["id"][];
  data: {
    area: number;
    percentage: number;
    criticality: "HIGH" | "MEDIUM";
    paths: Coordinates[][];
    center: Coordinates;
  };
}

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
