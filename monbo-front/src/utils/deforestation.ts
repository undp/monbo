import {
  DEFORESTATION_THRESHOLD_PERCENTAGE,
  OVERLAP_THRESHOLD_PERCENTAGE,
} from "@/config/env";

export const isOverlapAboveThreshold = (overlapValue: number) => {
  return 100 * overlapValue > OVERLAP_THRESHOLD_PERCENTAGE;
};

export const isDeforestationAboveThreshold = (deforestationValue: number) => {
  return 100 * deforestationValue > DEFORESTATION_THRESHOLD_PERCENTAGE;
};
