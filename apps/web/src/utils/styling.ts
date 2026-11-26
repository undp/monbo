import { RESULT_COLORS } from "@/config/theme";
import {
  classifyResult,
  type ClassificationRule,
  type ResultClass,
} from "./layerResults";

const RESULT_CLASS_COLORS: Record<ResultClass, string> = {
  ok: RESULT_COLORS.ok,
  flagged: RESULT_COLORS.flagged,
  unknown: RESULT_COLORS.unknown,
};

const RESULT_CLASS_BACKGROUND_COLORS: Record<ResultClass, string> = {
  ok: RESULT_COLORS.okBackground,
  flagged: RESULT_COLORS.flaggedBackground,
  unknown: RESULT_COLORS.unknownBackground,
};

export const resultClassColor = (resultClass: ResultClass) =>
  RESULT_CLASS_COLORS[resultClass];

export const resultClassBackgroundColor = (resultClass: ResultClass) =>
  RESULT_CLASS_BACKGROUND_COLORS[resultClass];

// The rule is the layer's category's, never assumed; a null rule (category
// missing) reads as no data.
export const getResultChipColor = (
  value: number | null | undefined,
  rule: ClassificationRule | null
) => resultClassColor(classifyResult(value, rule));

export const getResultChipBackgroundColor = (
  value: number | null | undefined,
  rule: ClassificationRule | null
) => resultClassBackgroundColor(classifyResult(value, rule));
