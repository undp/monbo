"use client";

import { DevEnvWarning } from "@/components/reusable/DevEnvWarning";
import { Footer } from "@/components/reusable/Footer";
import { Box, Button } from "@mui/material";
import { useCallback, useContext, useState } from "react";
import { useTranslation } from "react-i18next";
import { DownloadTypeSelectionModal } from "./DownloadTypeSelectionModal";
import { useDeforestationReportDownload } from "@/hooks/useDeforestationReportDownload";
import { DataContext } from "@/context/DataContext";

export function PageFooter() {
  const { t } = useTranslation();
  const {
    reportGenerationParams: { selectedFarms: selectedFarmsForReport },
  } = useContext(DataContext);
  const { downloadCompleteReport } = useDeforestationReportDownload();
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);

  const onDownloadReportClick = useCallback(async () => {
    // If there is only 1 farm selected, download inmediatly
    if (selectedFarmsForReport.length === 1) {
      setIsDownloading(true);
      await downloadCompleteReport();
      setIsDownloading(false);
      return;
    }

    // If there are more than 1 farm selected, open the download type selection modal
    setIsDownloadModalOpen(true);
  }, [selectedFarmsForReport, downloadCompleteReport]);

  return (
    <>
      <Footer>
        <Box
          sx={{
            width: "100%",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <DevEnvWarning />
          <Box sx={{ display: "flex", gap: 2 }}>
            <Button
              variant="contained"
              color="primary"
              onClick={onDownloadReportClick}
              loading={isDownloading}
            >
              {t("reportGeneration:buttons:download")}
            </Button>
          </Box>
        </Box>
      </Footer>
      <DownloadTypeSelectionModal
        isOpen={isDownloadModalOpen}
        handleClose={() => setIsDownloadModalOpen(false)}
      />
    </>
  );
}
