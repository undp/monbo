import { alpha } from "@mui/material";
import { isDeforestationAboveThreshold } from "./deforestation";

export const getDeforestationPercentageChipColor = (
  deforestationValue: number | null
) => {
  if (deforestationValue === null) return "#676767";
  return isDeforestationAboveThreshold(deforestationValue)
    ? "#D32F2F"
    : "#2E7D32";
};

export const getDeforestationPercentageChipBackgroundColor = (
  deforestationValue: number | null
) => {
  if (deforestationValue === null) return "#D5D5D5";
  return isDeforestationAboveThreshold(deforestationValue)
    ? alpha("#D32F2F", 0.08)
    : alpha("#2E7D32", 0.08);
};
