"use client";

import { useCallback, useContext, useRef, useState } from "react";
import { Box, Button } from "@mui/material";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import { useTranslation } from "react-i18next";
import { ReportContext } from "@/context/ReportContext";
import { useReportDownload } from "@/hooks/useReportDownload";
import { useReportPreviewRequest } from "@/hooks/useReportPreviewRequest";
import { FLOW_COLORS } from "@/components/page/flow/flowStyles";
import { ZipProgress } from "./ZipProgress";
import { DownloadFormatModal } from "./DownloadFormatModal";

/**
 * Under the choices: "Generar vista previa" renders the preview of the current
 * choice (and is off, saying why, when there is nothing to render or it is already
 * shown), and "Descargar" opens the format modal for the current choice, with or
 * without a preview.
 */
export const ReportActions: React.FC = () => {
  const { t } = useTranslation();
  const { previewState, isPreviewCurrent, farmCount } = useContext(ReportContext);
  const { missing, request: onPreview } = useReportPreviewRequest();
  const { downloadLargeReport } = useReportDownload();
  const [isModalOpen, setIsModalOpen] = useState(false);
  // A large report's ZIP job: farms done, and how to cancel it.
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(
    null
  );
  const zipJob = useRef<AbortController | null>(null);

  // While the current choice renders the button is off too: the panel shows it
  const reason = missing ?? (isPreviewCurrent && previewState === "ready" ? "upToDate" : null);
  const rendering = isPreviewCurrent && previewState === "loading";

  const onDownloadLargeReport = useCallback(async () => {
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
  }, [farmCount, downloadLargeReport]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <Button
        variant="contained"
        size="large"
        startIcon={<VisibilityOutlinedIcon />}
        disabled={!!reason || rendering}
        onClick={onPreview}
        aria-describedby={reason ? "report-preview-reason" : undefined}
      >
        {previewState === "idle"
          ? t("reportGeneration:actions.generatePreview")
          : t("reportGeneration:actions.updatePreview")}
      </Button>
      {reason && (
        <Box
          id="report-preview-reason"
          component="p"
          sx={{ margin: 0, fontSize: 13, color: FLOW_COLORS.muted, textAlign: "center" }}
        >
          {t(`reportGeneration:actions.${reason}`)}
        </Box>
      )}
      <Button
        variant="outlined"
        size="large"
        startIcon={<DownloadRoundedIcon />}
        disabled={!!missing || !!progress}
        onClick={() => setIsModalOpen(true)}
      >
        {t("reportGeneration:buttons:download")}
      </Button>
      {progress && (
        <ZipProgress
          done={progress.done}
          total={progress.total}
          onCancel={() => zipJob.current?.abort()}
        />
      )}
      <DownloadFormatModal
        isOpen={isModalOpen}
        handleClose={() => setIsModalOpen(false)}
        onDownloadLargeReport={onDownloadLargeReport}
      />
    </Box>
  );
};
