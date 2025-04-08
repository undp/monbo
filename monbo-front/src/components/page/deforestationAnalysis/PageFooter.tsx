"use client";

import { DevEnvWarning } from "@/components/reusable/DevEnvWarning";
import { Footer } from "@/components/reusable/Footer";
import { Box, Button } from "@mui/material";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { MapSelectionModal } from "./MapSelectionModal";
import { useRouter } from "next/navigation";

export function PageFooter() {
  const { t } = useTranslation();
  const router = useRouter();

  const [isMapSelectionModalOpen, setIsMapSelectionModalOpen] = useState(false);

  const handleOpenMapSelectionModal = () => {
    setIsMapSelectionModalOpen(true);
  };
  const handleCloseMapSelectionModal = () => {
    setIsMapSelectionModalOpen(false);
  };

  const handleContinue = useCallback(() => {
    router.push("/report-generation");
  }, [router]);

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
            <Button variant="contained" onClick={handleOpenMapSelectionModal}>
              {t("deforestationAnalysis:buttons:createReport")}
            </Button>
          </Box>
        </Box>
      </Footer>
      <MapSelectionModal
        isOpen={isMapSelectionModalOpen}
        handleClose={handleCloseMapSelectionModal}
        handleContinue={handleContinue}
      />
    </>
  );
}
