"use client";

import { DevEnvWarning } from "@/components/reusable/DevEnvWarning";
import { Footer } from "@/components/reusable/Footer";
import { NavigationButton } from "@/components/reusable/NavigationButton";
import { SnackbarContext } from "@/context/SnackbarContext";
import { useDeforestationReportDownload } from "@/hooks/useDeforestationReportDownload";
import { Box, Button, CircularProgress } from "@mui/material";
import { useState, useCallback, useContext } from "react";
import { useTranslation } from "react-i18next";

const namespaces = ["common", "deforestationAnalysis", "reportGeneration"];

export function PageFooter() {
  const { t } = useTranslation(namespaces);
  const { openSnackbar } = useContext(SnackbarContext);
  const { downloadCompleteReport, downloadSeparatedReports } =
    useDeforestationReportDownload();

  const [isDownloadingSeparatedReports, setIsDownloadingSeparatedReports] =
    useState(false);

  const [isDownloadingCompleteReport, setIsDownloadingCompleteReport] =
    useState(false);

  const handleDownloadSeparatedReports = useCallback(async () => {
    if (isDownloadingSeparatedReports) return;

    try {
      setIsDownloadingSeparatedReports(true);
      await downloadSeparatedReports();
    } catch (error) {
      console.error("Error downloading separated reports:", error);
      openSnackbar({
        message: t("common:snackbarAlerts:errorDownloadingSeparatedReports"),
        type: "error",
      });
    } finally {
      setIsDownloadingSeparatedReports(false);
    }
  }, [
    isDownloadingSeparatedReports,
    downloadSeparatedReports,
    openSnackbar,
    t,
  ]);

  const handleDownloadCompleteReport = useCallback(async () => {
    if (isDownloadingCompleteReport) return;

    try {
      setIsDownloadingCompleteReport(true);
      await downloadCompleteReport();
    } catch (error) {
      console.error("Error downloading complete report:", error);
      openSnackbar({
        message: t("common:snackbarAlerts:errorDownloadingCompleteReport"),
        type: "error",
      });
    } finally {
      setIsDownloadingCompleteReport(false);
    }
  }, [isDownloadingCompleteReport, downloadCompleteReport, openSnackbar, t]);

  return (
    <Footer>
      <Box
        sx={{ width: "100%", display: "flex", justifyContent: "space-between" }}
      >
        <DevEnvWarning />
        <Box sx={{ display: "flex", gap: 2 }}>
          <NavigationButton
            label={t("reportGeneration:buttons:preview")}
            route="report-generation/preview"
          />
          <Button
            sx={{
              pointerEvents: isDownloadingSeparatedReports ? "none" : "auto",
            }}
            variant="contained"
            color="primary"
            onClick={handleDownloadSeparatedReports}
          >
            <span
              style={{
                visibility: isDownloadingSeparatedReports
                  ? "hidden"
                  : "visible",
              }}
            >
              {t("reportGeneration:buttons:downloadSeparatedReports")}
            </span>
            {isDownloadingSeparatedReports && (
              <CircularProgress
                size={20}
                color="inherit"
                sx={{
                  position: "absolute",
                  left: "50%",
                  transform: "translateX(-50%)",
                }}
              />
            )}
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleDownloadCompleteReport}
          >
            <span
              style={{
                visibility: isDownloadingCompleteReport ? "hidden" : "visible",
              }}
            >
              {t("reportGeneration:buttons:downloadCompleteReport")}
            </span>
            {isDownloadingCompleteReport && (
              <CircularProgress
                size={20}
                color="inherit"
                sx={{
                  position: "absolute",
                  left: "50%",
                  transform: "translateX(-50%)",
                }}
              />
            )}
          </Button>
        </Box>
      </Box>
    </Footer>
  );
}
