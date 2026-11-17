import type { TFunction } from "i18next";
import { upperCase } from "lodash";
import type { LayerCategory } from "@/interfaces/LayerCategory";
import { formatFindingPercentage, formatPercentage } from "./numbers";
import {
  categoryRule,
  classifyResult,
  deforestationRule,
  findingRatio,
} from "./layerResults";
import { localizedText } from "./localizedText";

/**
 * The text of a layer result in stage 2 (results table and map popup), from its
 * class under the layer's category: the category's `ok` label; the finding and the
 * `flagged` label; or "no data". A layer whose category is missing (null) has no
 * rule, so every result is "no data".
 */
export const layerResultText = (
  value: number | null | undefined,
  category: LayerCategory | null,
  t: TFunction,
  language: string
): string => {
  const rule = category ? categoryRule(category) : null;
  const resultClass = classifyResult(value, rule);
  if (
    resultClass === "unknown" ||
    !category ||
    !rule ||
    value === null ||
    value === undefined
  )
    return t("deforestationAnalysis:noDataShortText");
  if (resultClass === "ok")
    return localizedText(category.resultLabels.ok, language);
  const finding = formatFindingPercentage(
    findingRatio(value, rule.polarity),
    rule.thresholdPercentage,
    language
  );
  return `${finding} · ${localizedText(category.resultLabels.flagged, language)}`;
};

// The text of a deforestation result, from its class: the PDF report, until it
// reads categories (GC-7).

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
