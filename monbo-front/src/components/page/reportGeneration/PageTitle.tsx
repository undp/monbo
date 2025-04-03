"use client";

import { Text } from "@/components/reusable/Text";
import { useTranslation } from "react-i18next";
import { formatNumber } from "@/utils/numbers";
import { Box } from "@mui/material";
import { useVisibleDataForDeforestationPage } from "@/hooks/useVisibleDataForDeforestationPage";

export const PageTitle: React.FC = () => {
  const { t } = useTranslation("reportGeneration");
  const { farmsData } = useVisibleDataForDeforestationPage();

  return (
    <>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Text variant="h3" bold>
          {t("reportGeneration:title")} (
          {formatNumber(selectedFarmsForReport.length)})
        </Text>
      </Box>
    </>
  );
};
