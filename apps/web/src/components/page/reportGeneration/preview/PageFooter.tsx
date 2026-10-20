"use client";

import { DevEnvWarning } from "@/components/reusable/DevEnvWarning";
import { Footer } from "@/components/reusable/Footer";
import { Box, Button } from "@mui/material";
import { useCallback, useContext, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { DownloadTypeSelectionModal } from "./DownloadTypeSelectionModal";
import { useDeforestationReportDownload } from "@/hooks/useDeforestationReportDownload";
import { DataContext } from "@/context/DataContext";
import { SHOW_TESTING_ENVIRONMENT_WARNING } from "@/config/env";
import { ReportContext } from "@/context/ReportContext";
import { ZipProgress } from "./ZipProgress";

export function PageFooter() {
  const { t } = useTranslation();
  const {
    reportGenerationParams: { selectedFarms: selectedFarmsForReport },
  } = useContext(DataContext);
  const { downloadCompleteReport, downloadLargeReport } =
    useDeforestationReportDownload();
  const { isLarge, farmCount } = useContext(ReportContext);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  // A large report's ZIP job: farms done, and how to cancel it.
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(
    null
  );
  const zipJob = useRef<AbortController | null>(null);

  const onDownloadReportClick = useCallback(async () => {
    // A large report has a single download: its ZIP, built farm by farm.
    if (isLarge) {
      const controller = new AbortController();
      zipJob.current = controller;
      setProgress({ done: 0, total: farmCount });
      await downloadLargeReport(
        // Only this job's progress: a cancelled one may still report a farm.
        (done, total) => {
          if (zipJob.current === controller) setProgress({ done, total });
        },
        controller.signal
      );
      if (zipJob.current === controller) {
        zipJob.current = null;
        setProgress(null);
      }
      return;
    }

    // If there is only 1 farm selected, download inmediatly
    if (selectedFarmsForReport.length === 1) {
      setIsDownloading(true);
      await downloadCompleteReport();
      setIsDownloading(false);
      return;
    }

    // If there are more than 1 farm selected, open the download type selection modal
    setIsDownloadModalOpen(true);
  }, [
    isLarge,
    farmCount,
    downloadLargeReport,
    selectedFarmsForReport,
    downloadCompleteReport,
  ]);

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
          {SHOW_TESTING_ENVIRONMENT_WARNING && <DevEnvWarning />}
          <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
            <Button
              variant="contained"
              color="primary"
              onClick={onDownloadReportClick}
              loading={isDownloading}
              // A large report's ZIP shows its progress in the middle of the page.
              disabled={!!progress}
            >
              {isLarge
                ? t("reportGeneration:buttons:downloadZip", {
                    count: farmCount,
                  })
                : t("reportGeneration:buttons:download")}
            </Button>
          </Box>
        </Box>
      </Footer>
      {progress && (
        <ZipProgress
          done={progress.done}
          total={progress.total}
          onCancel={() => zipJob.current?.abort()}
        />
      )}
      <DownloadTypeSelectionModal
        isOpen={isDownloadModalOpen}
        handleClose={() => setIsDownloadModalOpen(false)}
      />
    </>
  );
}
