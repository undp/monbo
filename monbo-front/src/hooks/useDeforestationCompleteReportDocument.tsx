import { DataContext } from "@/context/DataContext";
import { useContext, useMemo } from "react";
import { useVisibleDataForDeforestationPage } from "@/hooks/useVisibleDataForDeforestationPage";
import { DeforestationReportDocument } from "@/utils/deforestationReport";
import { useTranslation } from "react-i18next";
import { useParams } from "next/navigation";

export const useDeforestationCompleteReportDocument = () => {
  const { t } = useTranslation();
  const params = useParams();
  const locale = params.locale as string;
  const { deforestationAnalysisResults } = useVisibleDataForDeforestationPage();
  const {
    reportGenerationParams: {
      selectedMaps: selectedMapsForReport,
      selectedFarms: selectedFarmsForReport,
    },
  } = useContext(DataContext);

  const filteredDeforestationAnalysisResults = useMemo(() => {
    return deforestationAnalysisResults?.filter((m) =>
      selectedMapsForReport.some((map) => map.id === m.mapId)
    );
  }, [deforestationAnalysisResults, selectedMapsForReport]);

  return useMemo(
    () => (
      <DeforestationReportDocument
        farmsData={selectedFarmsForReport}
        deforestationAnalysisResults={filteredDeforestationAnalysisResults}
        mapsData={selectedMapsForReport}
        t={t}
        language={locale}
      />
    ),
    [
      selectedFarmsForReport,
      selectedMapsForReport,
      filteredDeforestationAnalysisResults,
      t,
      locale,
    ]
  );
};
