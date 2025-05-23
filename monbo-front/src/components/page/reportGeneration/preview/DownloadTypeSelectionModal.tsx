"use client";

import { BaseModal, BaseModalProps } from "@/components/reusable/BaseModal";
import { DataContext } from "@/context/DataContext";
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
    setIsDownloading(true);
    await downloadSeparatedReports();
    setIsDownloading(false);
  }, [downloadSeparatedReports]);

  const downloadCompleteReportWrapper = useCallback(async () => {
    setIsDownloading(true);
    await downloadCompleteReport();
    setIsDownloading(false);
  }, [downloadCompleteReport]);

  const handleDownloadButtonClick = useCallback(async () => {
    if (isDownloading) return;

    if (downloadType === "combined") {
      await downloadCompleteReportWrapper();
    } else {
      await downloadSeparatedReportsWrapper();
    }
    handleClose();
  }, [
    isDownloading,
    downloadType,
    downloadCompleteReportWrapper,
    downloadSeparatedReportsWrapper,
    handleClose,
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
