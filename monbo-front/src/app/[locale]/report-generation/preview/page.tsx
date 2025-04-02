"use client";

import { NavigateHomepageWhenEmptyData } from "@/components/reusable/NavigateHomepageWhenEmptyData";
import { PDFViewer } from "@react-pdf/renderer";
import { Box } from "@mui/material";
import { useDeforestationCompleteReportDocument } from "@/hooks/useDeforestationCompleteReportDocument";

export default function DeforestationAnalysis() {
  const document = useDeforestationCompleteReportDocument();

  return (
    <Box sx={{ width: "100%", height: "100vh" }}>
      <NavigateHomepageWhenEmptyData />
      <PDFViewer style={{ width: "100%", height: "100%" }} showToolbar>
        {document}
      </PDFViewer>
    </Box>
  );
}
