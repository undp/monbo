"use client";

import { DevEnvWarning } from "@/components/reusable/DevEnvWarning";
import { Footer } from "@/components/reusable/Footer";
import { DataContext } from "@/context/DataContext";
import { useDeforestationReportDownload } from "@/hooks/useDeforestationReportDownload";
import { Box, Button } from "@mui/material";
import { useRouter } from "next/navigation";
import { useCallback, useContext, useState } from "react";
import { useTranslation } from "react-i18next";
import { NoFarmsSelectedModal } from "./NoFarmsSelectedModal";

export function PageFooter() {
  const { t } = useTranslation();
  const router = useRouter();
  const {
    reportGenerationParams: { selectedFarms: selectedFarmsForReport },
  } = useContext(DataContext);
  const { downloadCompleteReport } = useDeforestationReportDownload();

  const [isDownloading, setIsDownloading] = useState(false);
  const [isEmptyFarmsSelectionModalOpen, setIsEmptyFarmsSelectionModalOpen] =
    useState(false);

  const onEmptyFarmsSelectionModalClose = useCallback(
    () => setIsEmptyFarmsSelectionModalOpen(false),
    []
  );

  const onGenerateReportClick = useCallback(async () => {
    // If there is no farm selected, show the empty farms selection modal
    if (selectedFarmsForReport.length === 0) {
      setIsEmptyFarmsSelectionModalOpen(true);
      return;
    }

    // If there is only 1 farm selected, download inmediatly
    if (selectedFarmsForReport.length === 1) {
      setIsDownloading(true);
      await downloadCompleteReport();
      setIsDownloading(false);
      return;
    }

    // If there is more than 1 farm selected, navigate to the preview page
    router.push("/report-generation/preview");
  }, [router, selectedFarmsForReport, downloadCompleteReport]);

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
              onClick={onGenerateReportClick}
              loading={isDownloading}
            >
              {t("reportGeneration:buttons:generateReport")}
            </Button>
          </Box>
        </Box>
      </Footer>
      <NoFarmsSelectedModal
        isOpen={isEmptyFarmsSelectionModalOpen}
        handleClose={onEmptyFarmsSelectionModalClose}
      />
    </>
  );
}
