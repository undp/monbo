"use client";

import { Footer } from "@/components/reusable/Footer";
import { Button, Box } from "@mui/material";
import { DeforestationModal } from "./DeforestationModal";
import { useState } from "react";
import { useTranslation } from "react-i18next";

export const PageFooter: React.FC = () => {
  const [isDeforestationModalOpen, setIsDeforestationModalOpen] =
    useState(false);
  const { t } = useTranslation();

  const handleOpenDeforestationModal = () => {
    setIsDeforestationModalOpen(true);
  };
  const handleCloseDeforestationModal = () => {
    setIsDeforestationModalOpen(false);
  };

  return (
    <>
      <Footer>
        <Box
          sx={{ width: "100%", display: "flex", justifyContent: "flex-end" }}
        >
          <Button onClick={handleOpenDeforestationModal} variant="contained">
            {t("polygonValidation:analize")}
          </Button>
        </Box>
      </Footer>
      <DeforestationModal
        isOpen={isDeforestationModalOpen}
        handleClose={handleCloseDeforestationModal}
      />
    </>
  );
};
