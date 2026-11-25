"use client";

import { Footer } from "@/components/reusable/Footer";
import { Button } from "@mui/material";
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
        <Button variant="contained" onClick={handleOpenMapSelectionModal}>
          {t("deforestationAnalysis:buttons:createReport")}
        </Button>
      </Footer>
      <MapSelectionModal
        isOpen={isMapSelectionModalOpen}
        handleClose={handleCloseMapSelectionModal}
        handleContinue={handleContinue}
      />
    </>
  );
}
