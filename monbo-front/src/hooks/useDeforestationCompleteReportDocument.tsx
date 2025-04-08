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
    reportGenerationParams: { selectedFarms: selectedFarmsForReport },
    deforestationAnalysisParams: { selectedMaps },
  } = useContext(DataContext);

  return useMemo(
    () => (
      <DeforestationReportDocument
        farmsData={selectedFarmsForReport}
        deforestationAnalysisResults={deforestationAnalysisResults}
        mapsData={selectedMaps}
        t={t}
        language={locale}
      />
    ),
    [
      selectedFarmsForReport,
      deforestationAnalysisResults,
      selectedMaps,
      t,
      locale,
    ]
  );
};
