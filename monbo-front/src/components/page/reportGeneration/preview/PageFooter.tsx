"use client";

import { DevEnvWarning } from "@/components/reusable/DevEnvWarning";
import { Footer } from "@/components/reusable/Footer";
import { Box, Button } from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { DownloadTypeSelectionModal } from "./DownloadTypeSelectionModal";

const namespaces = ["common", "deforestationAnalysis", "reportGeneration"];

export function PageFooter() {
  const { t } = useTranslation(namespaces);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);

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
              onClick={() => setIsDownloadModalOpen(true)}
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
