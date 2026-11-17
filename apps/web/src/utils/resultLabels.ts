import type { TFunction } from "i18next";
import { upperCase } from "lodash";
import { formatDeforestationPercentage, formatPercentage } from "./numbers";
import { classifyResult, deforestationRule } from "./layerResults";

// The text of a deforestation result, from its class. Shared by the results table,
// the map popup and the PDF, so the three name the same farms "free".

/** Short text: results table cells and the map popup. */
export const deforestationResultShortText = (
  value: number | null | undefined,
  t: TFunction,
  language: string
): string => {
  const resultClass = classifyResult(value, deforestationRule());
  if (resultClass === "unknown" || value === null || value === undefined)
    return t("common:na");
  if (resultClass === "ok")
    return t("deforestationAnalysis:deforestationFreeShortText");
  return `${formatDeforestationPercentage(value, language)} Def.`;
};

/** The result line of a farm's page in the PDF report. */
export const deforestationResultReportText = (
  value: number | null | undefined,
  t: TFunction,
  language?: string
): string => {
  const resultClass = classifyResult(value, deforestationRule());
  if (resultClass === "unknown" || value === null || value === undefined)
    return t("common:na");
  if (resultClass === "ok")
    return upperCase(t("reportGeneration:phrases:deforestationFree"));
  return `${formatPercentage(value, 1, language)} ${t(
    "reportGeneration:words:deforestation"
  ).toUpperCase()}`;
};
