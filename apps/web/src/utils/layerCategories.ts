import type { TFunction } from "i18next";
import type {
  DeforestationAnalysisMapResults,
  MapData,
} from "@/interfaces/DeforestationAnalysis";
import type { LayerCategory } from "@/interfaces/LayerCategory";
import {
  categoryRule,
  classifyResult,
  findingRatio,
  groupLayersByCategory,
  type ResultClass,
} from "./layerResults";
import { formatDeforestationPercentage } from "./numbers";
import { layerLabel } from "./layerLabel";
import { localizedText } from "./localizedText";

// How a layer result reads in the PDF report and the Excel and GeoJSON exports, so
// the three say the same thing. The class, the grouping by category and the
// formatting come from the shared modules (layerResults, numbers, localizedText).

export interface LayerResult {
  resultClass: ResultClass;
  /** The share of the farm that is a finding (0-1), or null with no data. */
  finding: number | null;
  /** The finding as a percentage ("18%", "< 2%"), or "No data". */
  findingText: string;
  /** The category's ok or flagged label, or "No data". */
  label: string;
}

/**
 * A farm's result for a layer, read with the layer's category: the class from its
 * rule, the finding and the category's label in `language`. A `null` or missing
 * value, or a layer without a known category, is "No data".
 */
export const layerResult = (
  value: number | null | undefined,
  category: LayerCategory | null,
  t: TFunction,
  language = "es"
): LayerResult => {
  if (!category || value === null || value === undefined) {
    const noData = t("common:layerResults:noData");
    return {
      resultClass: "unknown",
      finding: null,
      findingText: noData,
      label: noData,
    };
  }
  const rule = categoryRule(category);
  const resultClass = classifyResult(value, rule);
  // classifyResult is "unknown" only for null, handled above
  const labelClass = resultClass === "flagged" ? "flagged" : "ok";
  return {
    resultClass,
    finding: findingRatio(value, rule.polarity),
    findingText: formatDeforestationPercentage(value, language, rule),
    label: localizedText(category.resultLabels[labelClass], language),
  };
};

/** "Category · Layer": a layer named with its category, for export headers. */
export const categoryLayerName = (
  layer: Pick<MapData, "id" | "name" | "alias">,
  category: LayerCategory | null,
  t: TFunction,
  language = "es"
): string =>
  t("common:layerResults:categoryLayer", {
    category: category
      ? localizedText(category.name, language)
      : t("common:layerResults:noCategory"),
    layer: layerLabel(layer, "short"),
  });

/** One analysed layer in an export: its two localized headers and its results. */
export interface LayerResultColumns {
  findingHeader: string;
  resultHeader: string;
  /** A farm's result for the layer, read with its category (see `layerResult`). */
  result: (farmId: string) => LayerResult;
}

/**
 * A finding as an Excel number, in percent: sortable and the same in every
 * language. Rounded to 4 decimals, so the floating-point noise of `1 − value` goes
 * away while a finding just above a tiny threshold still shows. "No data" stays text.
 */
export const findingPercentCell = ({
  finding,
  findingText,
}: LayerResult): number | string =>
  finding === null ? findingText : Math.round(finding * 1e6) / 1e4;

/**
 * The export columns of the analysed layers, two per layer (finding and result), in
 * the order of the categories and then of the layers. `maps` are the analysed
 * layers (not today's catalog, which drops a layer whose category was disabled:
 * that layer stays, with "No data"). Results whose layer is not in `maps` are left
 * out.
 */
export const layerResultColumns = (
  results: Pick<DeforestationAnalysisMapResults, "mapId" | "farmResults">[],
  maps: MapData[],
  categories: LayerCategory[],
  t: TFunction,
  language = "es"
): LayerResultColumns[] => {
  const layers = results.flatMap((layerResults) => {
    const map = maps.find(({ id }) => id === layerResults.mapId);
    return map
      ? [{ id: map.id, categoryId: map.categoryId, map, layerResults }]
      : [];
  });
  return groupLayersByCategory(layers, categories).flatMap(
    ({ category, layers }) =>
      layers.map(({ map, layerResults }) => {
        const name = categoryLayerName(map, category, t, language);
        const valueByFarm = new Map(
          layerResults.farmResults.map(({ farmId, value }) => [farmId, value])
        );
        return {
          findingHeader: t("common:layerResults:findingHeader", { name }),
          resultHeader: t("common:layerResults:resultHeader", { name }),
          result: (farmId: string) =>
            layerResult(valueByFarm.get(farmId), category, t, language),
        };
      })
  );
};
