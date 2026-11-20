import { useMemo } from "react";
import { countResults } from "@/utils/layerResults";
import { useLayerRules } from "./useLayerRules";
import { useVisibleDataForAnalysisPage } from "./useVisibleDataForAnalysisPage";

/**
 * Per layer, how many farms are `ok` under the layer's category, or null when no
 * farm of that layer has a result (or the layer's category is missing).
 */
export const useNoObservationsCountByMap = () => {
  const { territorialAnalysisResults } = useVisibleDataForAnalysisPage();
  const readLayer = useLayerRules();

  return useMemo(
    () =>
      territorialAnalysisResults.map(({ mapId, farmResults }) => {
        const { category, rule } = readLayer(mapId);
        const counts = countResults(
          farmResults.map(({ value }) => value),
          rule
        );
        return {
          mapId,
          attr: `map_${mapId}`,
          category,
          count: counts.unknown === farmResults.length ? null : counts.ok,
        };
      }),
    [territorialAnalysisResults, readLayer]
  );
};
