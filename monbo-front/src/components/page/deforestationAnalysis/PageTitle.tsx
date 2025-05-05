"use client";

import { useState } from "react";
import { Text } from "@/components/reusable/Text";
import { useTranslation } from "react-i18next";
import { formatNumber } from "@/utils/numbers";
import { Box, IconButton } from "@mui/material";
import InfoOutlined from "@mui/icons-material/InfoOutlined";
import { MapsDetailsModal } from "./MapsDetailsModal";
import { useVisibleDataForDeforestationPage } from "@/hooks/useVisibleDataForDeforestationPage";

export const PageTitle: React.FC = () => {
  const { t } = useTranslation();
  const { farmsData } = useVisibleDataForDeforestationPage();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Text variant="h3" bold>
          {t("deforestationAnalysis:title")} (
          {formatNumber(farmsData?.length ?? 0, 0)})
        </Text>
        <IconButton onClick={() => setOpen(true)}>
          <InfoOutlined />
        </IconButton>
      </Box>
      <MapsDetailsModal open={open} onClose={() => setOpen(false)} />
    </>
  );
};
