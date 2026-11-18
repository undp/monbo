import { alpha } from "@mui/material/styles";
import {
  classifyResult,
  deforestationRule,
  type ClassificationRule,
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

// The rule defaults to deforestation (the PDF and the exports); stage 2 passes each
// layer's category rule, and a null rule (category missing) reads as no data.
export const getResultChipColor = (
  value: number | null | undefined,
  rule: ClassificationRule | null = deforestationRule()
) => resultClassColor(classifyResult(value, rule));

export const getResultChipBackgroundColor = (
  value: number | null | undefined,
  rule: ClassificationRule | null = deforestationRule()
) => resultClassBackgroundColor(classifyResult(value, rule));
