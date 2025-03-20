import { alpha } from "@mui/material";

export const getDeforestationPercentageChipColor = (
  deforestationValue: number | null
) => {
  if (deforestationValue === null) return "#676767";
  return deforestationValue === 0 ? "#2E7D32" : "#D32F2F";
};

export const getDeforestationPercentageChipBackgroundColor = (
  deforestationValue: number | null
) => {
  if (deforestationValue === null) return "#D5D5D5";
  return deforestationValue === 0
    ? alpha("#2E7D32", 0.08)
    : alpha("#D32F2F", 0.08);
};
