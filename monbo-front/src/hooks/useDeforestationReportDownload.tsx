import { DataContext } from "@/context/DataContext";
import { useCallback, useContext, useMemo } from "react";
import { pdf } from "@react-pdf/renderer";
import { useVisibleDataForDeforestationPage } from "@/hooks/useVisibleDataForDeforestationPage";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { DeforestationReportDocument } from "@/utils/deforestationReport";
import { useTranslation } from "react-i18next";
import { useParams } from "next/navigation";
import { SnackbarContext } from "@/context/SnackbarContext";
import { fetchDeforestationImages } from "@/utils/deforestationImages";

export const useDeforestationReportDownload = () => {
  const { t } = useTranslation(["deforestationAnalysis", "common"]);
  const { openSnackbar } = useContext(SnackbarContext);
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

  const downloadCompleteReportToFile = useCallback(async () => {
    // TODO: improve the performance of fetching the images
    const images = await fetchDeforestationImages(
      selectedMapsForReport,
      selectedFarmsForReport,
      filteredDeforestationAnalysisResults
    );

    const pdfBlob = await pdf(
      <DeforestationReportDocument
        farmsData={selectedFarmsForReport}
        deforestationAnalysisResults={filteredDeforestationAnalysisResults}
        mapsData={selectedMapsForReport}
        images={images}
        t={t}
        language={locale}
      />
    ).toBlob();
    // TODO: internationalize filename
    saveAs(pdfBlob, "deforestation-complete-report.pdf");
  }, [
    selectedFarmsForReport,
    filteredDeforestationAnalysisResults,
    selectedMapsForReport,
    t,
    locale,
  ]);

  const downloadSeparatedReportsToFile = useCallback(async () => {
    const zip = new JSZip();

    // TODO: improve the performance of fetching the images
    const images = await fetchDeforestationImages(
      selectedMapsForReport,
      selectedFarmsForReport,
      filteredDeforestationAnalysisResults
    );

    // Generate PDFs and add them to zip
    for (let i = 0; i < selectedFarmsForReport.length; i++) {
      const farm = selectedFarmsForReport[i];
      const pdfBlob = await pdf(
        <DeforestationReportDocument
          farmsData={[farm]}
          deforestationAnalysisResults={filteredDeforestationAnalysisResults}
          mapsData={selectedMapsForReport}
          images={images}
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
    filteredDeforestationAnalysisResults,
    selectedMapsForReport,
    t,
    locale,
  ]);

  const downloadSeparatedReportsWrapper = useCallback(async () => {
    try {
      await downloadSeparatedReportsToFile();
    } catch (error) {
      console.error("Error downloading separated reports:", error);
      openSnackbar({
        message: t("common:snackbarAlerts:errorDownloadingSeparatedReports"),
        type: "error",
      });
    }
  }, [downloadSeparatedReportsToFile, openSnackbar, t]);

  const downloadCompleteReportWrapper = useCallback(async () => {
    try {
      await downloadCompleteReportToFile();
    } catch (error) {
      console.error("Error downloading complete report:", error);
      openSnackbar({
        message: t("common:snackbarAlerts:errorDownloadingCompleteReport"),
        type: "error",
      });
    }
  }, [downloadCompleteReportToFile, openSnackbar, t]);

  return {
    downloadCompleteReport: downloadCompleteReportWrapper,
    downloadSeparatedReports: downloadSeparatedReportsWrapper,
  };
};
