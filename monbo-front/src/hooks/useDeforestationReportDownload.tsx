import { DataContext } from "@/context/DataContext";
import { useCallback, useContext } from "react";
import { pdf } from "@react-pdf/renderer";
import { useVisibleDataForDeforestationPage } from "@/hooks/useVisibleDataForDeforestationPage";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { DeforestationReportDocument } from "@/utils/deforestationReport";
import { useTranslation } from "react-i18next";
import { useParams } from "next/navigation";

export const useDeforestationReportDownload = () => {
  const { t } = useTranslation(["deforestationAnalysis", "common"]);
  const params = useParams();
  const locale = params.locale as string;
  const { deforestationAnalysisResults } = useVisibleDataForDeforestationPage();
  const {
    reportGenerationParams: { selectedFarms: selectedFarmsForReport },
    deforestationAnalysisParams: { selectedMaps },
  } = useContext(DataContext);

  const downloadCompleteReport = useCallback(async () => {
    const pdfBlob = await pdf(
      <DeforestationReportDocument
        farmsData={selectedFarmsForReport}
        deforestationAnalysisResults={deforestationAnalysisResults}
        mapsData={selectedMaps}
        t={t}
        language={locale}
      />
    ).toBlob();
    // TODO: internationalize filename
    saveAs(pdfBlob, "deforestation-complete-report.pdf");
  }, [
    selectedFarmsForReport,
    deforestationAnalysisResults,
    selectedMaps,
    t,
    locale,
  ]);

  const downloadSeparatedReports = useCallback(async () => {
    const zip = new JSZip();

    // Generate PDFs and add them to zip
    for (let i = 0; i < selectedFarmsForReport.length; i++) {
      const farm = selectedFarmsForReport[i];
      const pdfBlob = await pdf(
        <DeforestationReportDocument
          farmsData={[farm]}
          deforestationAnalysisResults={deforestationAnalysisResults}
          mapsData={selectedMaps}
          t={t}
          language={locale}
        />
      ).toBlob();

      zip.file(`report_farm_${farm.id}.pdf`, pdfBlob);
    }

    // Generate ZIP and trigger download
    const zipBlob = await zip.generateAsync({ type: "blob" });
    // TODO: internationalize filename
    saveAs(zipBlob, "deforestation-reports.zip");
  }, [
    selectedFarmsForReport,
    deforestationAnalysisResults,
    selectedMaps,
    t,
    locale,
  ]);

  return { downloadCompleteReport, downloadSeparatedReports };
};
