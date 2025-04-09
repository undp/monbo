"use client";

import { BaseModal, BaseModalProps } from "@/components/reusable/BaseModal";
import { DataContext } from "@/context/DataContext";
import { SnackbarContext } from "@/context/SnackbarContext";
import { useDeforestationReportDownload } from "@/hooks/useDeforestationReportDownload";
import {
  Box,
  Button,
  FormControlLabel,
  Radio,
  RadioGroup,
} from "@mui/material";
import { useCallback, useContext, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

export const DownloadTypeSelectionModal: React.FC<
  Pick<BaseModalProps, "isOpen" | "handleClose">
> = ({ isOpen, handleClose }) => {
  const { t } = useTranslation();
  const { openSnackbar } = useContext(SnackbarContext);
  const {
    reportGenerationParams: {
      selectedFarms: selectedFarmsForReport,
      downloadType,
    },
    setReportGenerationParams,
  } = useContext(DataContext);
  const { downloadCompleteReport, downloadSeparatedReports } =
    useDeforestationReportDownload();

  const [isDownloading, setIsDownloading] = useState(false);

  const selectedFarmsAmount = useMemo(
    () => selectedFarmsForReport?.length || 0,
    [selectedFarmsForReport]
  );

  const onDownloadTypeSelectionChange = useCallback(
    (value: "combined" | "separated") => {
      setReportGenerationParams((prev) => ({
        ...prev,
        downloadType: value,
      }));
    },
    [setReportGenerationParams]
  );

  const downloadSeparatedReportsWrapper = useCallback(async () => {
    try {
      setIsDownloading(true);
      await downloadSeparatedReports();
    } catch (error) {
      console.error("Error downloading separated reports:", error);
      openSnackbar({
        message: t("common:snackbarAlerts:errorDownloadingSeparatedReports"),
        type: "error",
      });
    } finally {
      setIsDownloading(false);
    }
  }, [downloadSeparatedReports, openSnackbar, t]);

  const downloadCompleteReportWrapper = useCallback(async () => {
    try {
      setIsDownloading(true);
      await downloadCompleteReport();
    } catch (error) {
      console.error("Error downloading complete report:", error);
      openSnackbar({
        message: t("common:snackbarAlerts:errorDownloadingCompleteReport"),
        type: "error",
      });
    } finally {
      setIsDownloading(false);
    }
  }, [downloadCompleteReport, openSnackbar, t]);

  const handleDownloadButtonClick = useCallback(async () => {
    if (isDownloading) return;

    if (downloadType === "combined") {
      downloadCompleteReportWrapper();
    } else {
      downloadSeparatedReportsWrapper();
    }
  }, [
    isDownloading,
    downloadType,
    downloadCompleteReportWrapper,
    downloadSeparatedReportsWrapper,
  ]);

  return (
    <BaseModal
      isOpen={isOpen}
      handleClose={handleClose}
      title={t("reportGeneration:downloadTypeSelectionModal:title")}
      maxWidth="sm"
    >
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <RadioGroup value={downloadType} sx={{ gap: 0 }}>
          <FormControlLabel
            value="combined"
            control={<Radio />}
            label={`${t(
              "reportGeneration:downloadTypeSelectionModal:combinedOptionText",
              { amount: selectedFarmsAmount }
            )}`}
            onChange={() => onDownloadTypeSelectionChange("combined")}
          />
          <FormControlLabel
            value="separated"
            control={<Radio />}
            label={`${t(
              "reportGeneration:downloadTypeSelectionModal:separatedOptionText",
              { amount: selectedFarmsAmount }
            )}`}
            onChange={() => onDownloadTypeSelectionChange("separated")}
          />
        </RadioGroup>
      </Box>
      <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
        <Button
          variant="contained"
          disabled={!downloadType}
          onClick={handleDownloadButtonClick}
          loading={isDownloading}
        >
          {t("reportGeneration:downloadTypeSelectionModal:button")}
        </Button>
      </Box>
    </BaseModal>
  );
};
