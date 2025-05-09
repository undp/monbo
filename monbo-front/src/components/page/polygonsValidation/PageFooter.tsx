"use client";

import { Footer } from "@/components/reusable/Footer";
import { Button, Box } from "@mui/material";
import { DeforestationModal } from "./DeforestationModal";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { SHOW_TESTING_ENVIRONMENT_WARNING } from "@/config/env";
import { DevEnvWarning } from "@/components/reusable/DevEnvWarning";

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
          sx={{
            width: "100%",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          {SHOW_TESTING_ENVIRONMENT_WARNING && <DevEnvWarning />}
          <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
            <Button onClick={handleOpenDeforestationModal} variant="contained">
              {t("polygonValidation:analize")}
            </Button>
          </Box>
        </Box>
      </Footer>
      <DeforestationModal
        isOpen={isDeforestationModalOpen}
        handleClose={handleCloseDeforestationModal}
      />
    </>
  );
};
