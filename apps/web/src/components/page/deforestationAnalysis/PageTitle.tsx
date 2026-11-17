"use client";

import { useContext, useState } from "react";
import { Text } from "@/components/reusable/Text";
import { useTranslation } from "react-i18next";
import { Box, IconButton } from "@mui/material";
import InfoOutlined from "@mui/icons-material/InfoOutlined";
import { MapsDetailsModal } from "./MapsDetailsModal";
import { useVisibleDataForDeforestationPage } from "@/hooks/useVisibleDataForDeforestationPage";
import { DataContext } from "@/context/DataContext";
import { getCountryName } from "@/utils/countries";

/** The results' title, and how many polygons were crossed with how many layers. */
export const PageTitle: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { selectedCountry } = useContext(DataContext);
  const { farmsData, deforestationAnalysisResults } =
    useVisibleDataForDeforestationPage();
  const [open, setOpen] = useState(false);
  const country = selectedCountry
    ? (getCountryName(selectedCountry, i18n.language === "en" ? "en" : "es") ??
      selectedCountry)
    : "";

  return (
    <>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Text variant="h3" bold>
          {t("deforestationAnalysis:results.title")}
        </Text>
        <IconButton
          onClick={() => setOpen(true)}
          aria-label={t("deforestationAnalysis:mapsInfoModal:title")}
        >
          <InfoOutlined />
        </IconButton>
      </Box>
      <Text sx={{ color: "text.secondary" }}>
        {t("deforestationAnalysis:results.subtitle", {
          polygons: t("deforestationAnalysis:results.polygonCount", {
            count: farmsData.length,
          }),
          layers: t("deforestationAnalysis:results.layerCount", {
            count: deforestationAnalysisResults.length,
          }),
          country,
        })}
      </Text>
      <MapsDetailsModal open={open} onClose={() => setOpen(false)} />
    </>
  );
};
