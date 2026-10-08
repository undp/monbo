"use client";

import { useContext } from "react";
import { useTranslation } from "react-i18next";
import { Box, CircularProgress } from "@mui/material";
import { ReportContext } from "@/context/ReportContext";

export const ReportGenerationPreviewPageContent = () => {
  const { t } = useTranslation();
  // Rendered in a worker (ReportProvider): the page stays responsive meanwhile.
  const { previewUrl, isPreviewLoading } = useContext(ReportContext);

  return (
    <Box
      sx={{
        width: "100%",
        height: "calc(100vh - 64px - 64px)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {previewUrl && (
        <iframe
          // No toolbar, like the previous <PDFViewer showToolbar={false}>.
          src={`${previewUrl}#toolbar=0`}
          title={t("reportGeneration:preview:title")}
          style={{ width: "100%", height: "100%", border: "none" }}
        />
      )}
      {isPreviewLoading && <CircularProgress size={100} />}
    </Box>
  );
};
