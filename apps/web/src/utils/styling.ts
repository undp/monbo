import { alpha } from "@mui/material/styles";
import {
  classifyResult,
  deforestationRule,
  type ResultClass,
} from "./layerResults";

const RESULT_CLASS_COLORS: Record<ResultClass, string> = {
  ok: "#2E7D32",
  flagged: "#D32F2F",
  unknown: "#676767",
};

const RESULT_CLASS_BACKGROUND_COLORS: Record<ResultClass, string> = {
  ok: alpha("#2E7D32", 0.08),
  flagged: alpha("#D32F2F", 0.08),
  unknown: "#D5D5D5",
};

export const resultClassColor = (resultClass: ResultClass) =>
  RESULT_CLASS_COLORS[resultClass];

export const resultClassBackgroundColor = (resultClass: ResultClass) =>
  RESULT_CLASS_BACKGROUND_COLORS[resultClass];

export const getDeforestationPercentageChipColor = (
  deforestationValue: number | null | undefined
) => resultClassColor(classifyResult(deforestationValue, deforestationRule()));

export const getDeforestationPercentageChipBackgroundColor = (
  deforestationValue: number | null | undefined
) =>
  resultClassBackgroundColor(
    classifyResult(deforestationValue, deforestationRule())
  );
