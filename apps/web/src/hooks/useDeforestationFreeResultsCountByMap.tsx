import { useMemo } from "react";
import { countResults, deforestationRule } from "@/utils/layerResults";
import { useVisibleDataForDeforestationPage } from "./useVisibleDataForDeforestationPage";

/**
 * Per layer, how many farms are deforestation-free (`ok`), or null when no farm of
 * that layer has a result.
 */
export const useDeforestationFreeResultsCountByMap = () => {
  const { deforestationAnalysisResults } = useVisibleDataForDeforestationPage();

  return useMemo(() => {
    const rule = deforestationRule();
    return deforestationAnalysisResults.map(({ mapId, farmResults }) => {
      const counts = countResults(
        farmResults.map(({ value }) => value),
        rule
      );
      return {
        mapId,
        attr: `map_${mapId}`,
        count: counts.unknown === farmResults.length ? null : counts.ok,
      };
    });
  }, [deforestationAnalysisResults]);
};
