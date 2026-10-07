import {
  getDeforestationThreshold,
  getOverlapThreshold,
} from "@/config/runtime";

export const isOverlapAboveThreshold = (overlapValue: number) => {
  return 100 * overlapValue > getOverlapThreshold();
};

export const isDeforestationAboveThreshold = (deforestationValue: number) => {
  return 100 * deforestationValue > getDeforestationThreshold();
};
