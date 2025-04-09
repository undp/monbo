"use client";

import { useDeforestationCompleteReportDocument } from "@/hooks/useDeforestationCompleteReportDocument";
import { Box } from "@mui/material";
import { PDFViewer } from "@react-pdf/renderer";

export const ReportGenerationPreviewPageContent = () => {
  const document = useDeforestationCompleteReportDocument();
  return (
    <Box sx={{ width: "100%", height: "calc(100vh - 64px - 64px)" }}>
      <PDFViewer style={{ width: "100%", height: "100%" }} showToolbar>
        {document}
      </PDFViewer>
    </Box>
  );
};
