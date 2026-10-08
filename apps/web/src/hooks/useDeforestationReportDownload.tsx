import { DataContext } from "@/context/DataContext";
import { useCallback, useContext } from "react";
import { saveAs } from "file-saver";
import { useTranslation } from "react-i18next";
import { SnackbarContext } from "@/context/SnackbarContext";
import { ReportContext } from "@/context/ReportContext";
import { MapLayerChangedError } from "@/api/deforestationAnalysis";

export const useDeforestationReportDownload = () => {
  const { t } = useTranslation(["deforestationAnalysis", "common"]);
  const { openSnackbar } = useContext(SnackbarContext);
  const { invalidateAnalysis } = useContext(DataContext);
  // The images and the renders come from the report page (ReportProvider): the
  // preview's images are reused, and the complete report is usually pre-rendered.
  const { getCompleteReport, getSeparatedReports } = useContext(ReportContext);

  const downloadSeparatedReports = useCallback(async () => {
    try {
      const zipBlob = await getSeparatedReports();
      // TODO: internationalize filename
      saveAs(zipBlob, "deforestation-reports.zip");
    } catch (error) {
      // A layer got a new raster after the analysis: re-run it instead of
      // producing reports that mix both rasters.
      if (error instanceof MapLayerChangedError) return invalidateAnalysis();
      console.error("Error downloading separated reports:", error);
      openSnackbar({
        message: t("common:snackbarAlerts:errorDownloadingSeparatedReports"),
        type: "error",
      });
    }
  }, [getSeparatedReports, invalidateAnalysis, openSnackbar, t]);

  const downloadCompleteReport = useCallback(async () => {
    try {
      const pdfBlob = await getCompleteReport();
      // TODO: internationalize filename
      saveAs(pdfBlob, "deforestation-complete-report.pdf");
    } catch (error) {
      if (error instanceof MapLayerChangedError) return invalidateAnalysis();
      console.error("Error downloading complete report:", error);
      openSnackbar({
        message: t("common:snackbarAlerts:errorDownloadingCompleteReport"),
        type: "error",
      });
    }
  }, [getCompleteReport, invalidateAnalysis, openSnackbar, t]);

  return { downloadCompleteReport, downloadSeparatedReports };
};
