import { DataContext } from "@/context/DataContext";
import { useContext, useMemo } from "react";
import { useVisibleDataForDeforestationPage } from "@/hooks/useVisibleDataForDeforestationPage";
import { DeforestationReportDocument } from "@/utils/deforestationReport";

export const useDeforestationCompleteReportDocument = () => {
  const { farmsData, deforestationAnalysisResults } =
    useVisibleDataForDeforestationPage();
  const {
    deforestationAnalysisParams: { selectedMaps },
  } = useContext(DataContext);

  return useMemo(
    () => (
      <DeforestationReportDocument
        farmsData={farmsData}
        deforestationAnalysisResults={deforestationAnalysisResults}
        mapsData={selectedMaps}
      />
    ),
    [farmsData, deforestationAnalysisResults, selectedMaps]
  );
};
