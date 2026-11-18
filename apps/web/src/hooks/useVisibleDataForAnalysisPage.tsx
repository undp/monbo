import { DataContext, DataContextValue } from "@/context/DataContext";
import { FarmData } from "@/interfaces/Farm";
import { FarmValidationStatus } from "@/interfaces/PolygonValidation";
import { useContext, useMemo } from "react";

type ReturnType = {
  farmsData: FarmData[];
  territorialAnalysisResults: NonNullable<
    DataContextValue["territorialAnalysisResults"]
  >;
};

export const useVisibleDataForAnalysisPage = (): ReturnType => {
  const {
    farmsData,
    polygonsValidationResults,
    territorialAnalysisParams: { polygonsSubset, selectedMaps },
    territorialAnalysisResults,
  } = useContext(DataContext);

  // Hide farms that user doesn't want to see, because analysis was done for all farms under the hood
  const visibleFarms = useMemo<FarmData[]>(() => {
    if (!farmsData || !territorialAnalysisResults) return [];

    if (!polygonsSubset || polygonsSubset === "all") return farmsData;

    return farmsData.filter(
      (f) =>
        polygonsValidationResults?.farmResults.find(
          ({ farmId }) => farmId === f.id
        )?.status !== FarmValidationStatus.NOT_VALID
    );
  }, [
    farmsData,
    territorialAnalysisResults,
    polygonsSubset,
    polygonsValidationResults,
  ]);

  // Filter the analysis results to show only the ones for the selected maps, because analysis could had been done for more maps under the hood
  const visibleResults = useMemo<
    NonNullable<DataContextValue["territorialAnalysisResults"]>
  >(() => {
    if (!territorialAnalysisResults) return [];

    return territorialAnalysisResults
      .filter(({ mapId }) => selectedMaps.some(({ id }) => id === mapId))
      .map(({ farmResults, ...mapResults }) => ({
        // Keeps `version`: report images are checked against it.
        ...mapResults,
        farmResults: farmResults.filter(({ farmId }) =>
          visibleFarms.some(({ id }) => id === farmId)
        ),
      }));
  }, [territorialAnalysisResults, selectedMaps, visibleFarms]);

  return {
    farmsData: visibleFarms,
    territorialAnalysisResults: visibleResults,
  };
};
