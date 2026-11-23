import { DataContext } from "@/context/DataContext";
import { useCallback, useContext } from "react";
import { saveAs } from "file-saver";
import { useTranslation } from "react-i18next";
import { SnackbarContext } from "@/context/SnackbarContext";
import { ReportContext } from "@/context/ReportContext";
import { MapLayerChangedError } from "@/api/deforestationAnalysis";
import { ReportPdfWorkerTerminatedError } from "@/workers/reportPdfClient";
import { sendUsageEvent } from "@/api/usageEvents";

export const useDeforestationReportDownload = () => {
  const { t } = useTranslation(["deforestationAnalysis", "common"]);
  const { openSnackbar } = useContext(SnackbarContext);
  const {
    invalidateAnalysis,
    selectedCountry,
    reportGenerationParams: { selectedFarms },
  } = useContext(DataContext);
  // A finished download, or one that failed with the error shown to the user.
  // Cancelled ones, a page left mid-render and a layer that changed are not
  // reported: none of them is a failed download.
  const reportDownload = useCallback(
    (format: "pdf" | "zip", outcome: "ok" | "error") =>
      sendUsageEvent(
        {
          type: "report_downloaded",
          outcome,
          format,
          farms: selectedFarms.length,
        },
        selectedCountry
      ),
    [selectedFarms.length, selectedCountry]
  );
  // The images and the renders come from the report page (ReportProvider): the
  // preview's images are reused, and the complete report is usually pre-rendered.
  const { getCompleteReport, getSeparatedReports, buildLargeReportZip } =
    useContext(ReportContext);

  const downloadSeparatedReports = useCallback(async () => {
    try {
      const zipBlob = await getSeparatedReports();
      // TODO: internationalize filename
      saveAs(zipBlob, "deforestation-reports.zip");
      reportDownload("zip", "ok");
    } catch (error) {
      // The user left the report page: there is nothing to save or to report.
      if (error instanceof ReportPdfWorkerTerminatedError) return;
      // A layer got a new raster after the analysis: re-run it instead of
      // producing reports that mix both rasters.
      if (error instanceof MapLayerChangedError) return invalidateAnalysis();
      console.error("Error downloading separated reports:", error);
      reportDownload("zip", "error");
      openSnackbar({
        message: t("common:snackbarAlerts:errorDownloadingSeparatedReports"),
        type: "error",
      });
    }
  }, [getSeparatedReports, invalidateAnalysis, openSnackbar, reportDownload, t]);

  const downloadCompleteReport = useCallback(async () => {
    try {
      const pdfBlob = await getCompleteReport();
      // TODO: internationalize filename
      saveAs(pdfBlob, "deforestation-complete-report.pdf");
      reportDownload("pdf", "ok");
    } catch (error) {
      if (error instanceof ReportPdfWorkerTerminatedError) return;
      if (error instanceof MapLayerChangedError) return invalidateAnalysis();
      console.error("Error downloading complete report:", error);
      reportDownload("pdf", "error");
      openSnackbar({
        message: t("common:snackbarAlerts:errorDownloadingCompleteReport"),
        type: "error",
      });
    }
  }, [getCompleteReport, invalidateAnalysis, openSnackbar, reportDownload, t]);

  /** A large report's ZIP, built farm by farm; `signal` cancels it. */
  const downloadLargeReport = useCallback(
    async (
      onProgress: (done: number, total: number) => void,
      signal?: AbortSignal
    ) => {
      try {
        const zipBlob = await buildLargeReportZip(onProgress, signal);
        // TODO: internationalize filename
        saveAs(zipBlob, "deforestation-reports.zip");
        reportDownload("zip", "ok");
      } catch (error) {
        // Cancelled by the user, or stopped because the selection changed or the
        // page went away: nothing to save or to report.
        if (
          signal?.aborted ||
          error instanceof ReportPdfWorkerTerminatedError ||
          (error instanceof DOMException && error.name === "AbortError")
        )
          return;
        if (error instanceof MapLayerChangedError) return invalidateAnalysis();
        console.error("Error downloading the large report:", error);
        reportDownload("zip", "error");
        openSnackbar({
          message: t("common:snackbarAlerts:errorDownloadingSeparatedReports"),
          type: "error",
        });
      }
    },
    [buildLargeReportZip, invalidateAnalysis, openSnackbar, reportDownload, t]
  );

  return {
    downloadCompleteReport,
    downloadSeparatedReports,
    downloadLargeReport,
  };
};
