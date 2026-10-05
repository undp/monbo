import { useMemo } from "react";
import { useVisibleDataForDeforestationPage } from "./useVisibleDataForDeforestationPage";

export const useDeforestationFreeResultsCountByMap = () => {
  const { deforestationAnalysisResults } = useVisibleDataForDeforestationPage();

  return useMemo(
    () =>
      deforestationAnalysisResults.map(({ mapId, farmResults }) => ({
        mapId,
        attr: `map_${mapId}`,
        count: farmResults.every(({ value }) => value === null)
          ? null
          : farmResults.filter(({ value }) => value === 0).length,
      })),
    [deforestationAnalysisResults]
  );
};
