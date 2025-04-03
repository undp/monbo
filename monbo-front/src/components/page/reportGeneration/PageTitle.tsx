"use client";

import { Text } from "@/components/reusable/Text";
import { useTranslation } from "react-i18next";
import { formatNumber } from "@/utils/numbers";
import { Box } from "@mui/material";
import { useContext } from "react";
import { DataContext } from "@/context/DataContext";

export const PageTitle: React.FC = () => {
  const { t } = useTranslation("reportGeneration");
  const { selectedFarmsForReport } = useContext(DataContext);

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
