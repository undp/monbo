"use client";

import { DevEnvWarning } from "@/components/reusable/DevEnvWarning";
import { Footer } from "@/components/reusable/Footer";
import { DataContext } from "@/context/DataContext";
import { Box, Button } from "@mui/material";
import { useRouter } from "next/navigation";
import { useCallback, useContext, useState } from "react";
import { useTranslation } from "react-i18next";
import { NoFarmsSelectedModal } from "./NoFarmsSelectedModal";
import { SHOW_TESTING_ENVIRONMENT_WARNING } from "@/config/env";

export function PageFooter() {
  const { t } = useTranslation();
  const router = useRouter();
  const {
    reportGenerationParams: { selectedFarms: selectedFarmsForReport },
  } = useContext(DataContext);

  const [isEmptyFarmsSelectionModalOpen, setIsEmptyFarmsSelectionModalOpen] =
    useState(false);

  const onEmptyFarmsSelectionModalClose = useCallback(
    () => setIsEmptyFarmsSelectionModalOpen(false),
    []
  );

  const onGenerateReportClick = useCallback(async () => {
    // If there is no farm selected, show the empty farms selection modal
    if (selectedFarmsForReport.length === 0) {
      setIsEmptyFarmsSelectionModalOpen(true);
      return;
    }

    // If there are farms selected, navigate to the preview page
    router.push("/report-generation/preview");
  }, [router, selectedFarmsForReport]);

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
          <Box sx={{ display: "flex", gap: 2 }}>
            <Button variant="contained" onClick={onGenerateReportClick}>
              {t("reportGeneration:buttons:generateReport")}
            </Button>
          </Box>
        </Box>
      </Footer>
      <NoFarmsSelectedModal
        isOpen={isEmptyFarmsSelectionModalOpen}
        handleClose={onEmptyFarmsSelectionModalClose}
      />
    </>
  );
}
