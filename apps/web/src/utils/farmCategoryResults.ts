import type { LayerCategory } from "@/interfaces/LayerCategory";
import type { LayerAnalysisMapResults, MapData } from "@/interfaces/LayerAnalysis";
import {
  categoryRule,
  classifyFarmInCategory,
  classifyResult,
  groupLayersByCategory,
  type ResultClass,
} from "./layerResults";

export interface FarmLayerResult {
  layer: MapData;
  /** The layer's result for the farm: null when it couldn't be computed. */
  value: number | null;
  resultClass: ResultClass;
}

export interface FarmCategoryResult {
  category: LayerCategory;
  /** The farm's worst class among `layers` (see classifyFarmInCategory). */
  resultClass: ResultClass;
  layers: FarmLayerResult[];
}

/**
 * Per farm, its result in each category of `layers`: the worst class among the
 * category's layers, and each layer's own. Layers whose category is missing have no
 * rule and are left out. Computed once for every farm, so a row only reads it.
 */
export const farmCategoryResults = (
  farms: { id: string }[],
  results: Pick<LayerAnalysisMapResults, "mapId" | "farmResults">[],
  layers: MapData[],
  categories: LayerCategory[]
): Map<string, FarmCategoryResult[]> => {
  const valuesByLayer = new Map(
    results.map(({ mapId, farmResults }) => [
      mapId,
      new Map(farmResults.map(({ farmId, value }) => [farmId, value])),
    ])
  );
  const groups = groupLayersByCategory(layers, categories).flatMap(
    ({ category, layers }) =>
      category ? [{ category, rule: categoryRule(category), layers }] : []
  );
  return new Map(
    farms.map((farm) => [
      farm.id,
      groups.map(({ category, rule, layers }) => {
        const layerResults = layers.map((layer) => {
          const value = valuesByLayer.get(layer.id)?.get(farm.id) ?? null;
          return { layer, value, resultClass: classifyResult(value, rule) };
        });
        return {
          category,
          resultClass: classifyFarmInCategory(
            layerResults.map(({ resultClass }) => resultClass)
          ),
          layers: layerResults,
        };
      }),
    ])
  );
};
