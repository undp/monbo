import { DataContext, DataContextValue } from "@/context/DataContext";
import { FarmData } from "@/interfaces/Farm";
import { FarmValidationStatus } from "@/interfaces/PolygonValidation";
import { useContext, useMemo } from "react";

type ReturnType = {
  farmsData: FarmData[];
  deforestationAnalysisResults: NonNullable<
    DataContextValue["deforestationAnalysisResults"]
  >;
};

export const useVisibleDataForDeforestationPage = (): ReturnType => {
  const {
    farmsData,
    polygonsValidationResults,
    deforestationAnalysisParams: { polygonsSubset, selectedMaps },
    deforestationAnalysisResults,
  } = useContext(DataContext);

  // Hide farms that user doesn't want to see, because analysis was done for all farms under the hood
  const visibleFarms = useMemo<FarmData[]>(() => {
    if (!farmsData || !deforestationAnalysisResults) return [];

    if (!polygonsSubset || polygonsSubset === "all") return farmsData;

    return farmsData.filter(
      (f) =>
        polygonsValidationResults?.farmResults.find(
          ({ farmId }) => farmId === f.id
        )?.status !== FarmValidationStatus.NOT_VALID
    );
  }, [
    farmsData,
    deforestationAnalysisResults,
    polygonsSubset,
    polygonsValidationResults,
  ]);

  // Filter deforestation results to show only the ones for the selected maps, because analysis could had been done for more maps under the hood
  const deforestationVisibleResults = useMemo<
    NonNullable<DataContextValue["deforestationAnalysisResults"]>
  >(() => {
    if (!deforestationAnalysisResults) return [];

    return deforestationAnalysisResults
      .filter(({ mapId }) => selectedMaps.some(({ id }) => id === mapId))
      .map(({ mapId, farmResults }) => ({
        mapId,
        farmResults: farmResults.filter(({ farmId }) =>
          visibleFarms.some(({ id }) => id === farmId)
        ),
      }));
  }, [deforestationAnalysisResults, selectedMaps, visibleFarms]);

  return {
    farmsData: visibleFarms,
    deforestationAnalysisResults: deforestationVisibleResults,
  };
};
