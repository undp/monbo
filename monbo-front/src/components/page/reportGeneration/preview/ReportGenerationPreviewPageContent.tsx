"use client";

import { useDeforestationCompleteReportDocument } from "@/hooks/useDeforestationCompleteReportDocument";
import { Box, CircularProgress } from "@mui/material";
import { PDFViewer } from "@react-pdf/renderer";

export const ReportGenerationPreviewPageContent = () => {
  const { document, isLoading } = useDeforestationCompleteReportDocument();

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
      {!!document && (
        <Box
          sx={{
            width: isLoading ? "0%" : "100%",
            height: isLoading ? "0%" : "100%",
            visibility: isLoading ? "hidden" : "visible",
          }}
        >
          <PDFViewer style={{ width: "100%", height: "100%" }} showToolbar>
            {document}
          </PDFViewer>
        </Box>
      )}
      {isLoading && <CircularProgress size={100} />}
    </Box>
  );
};
