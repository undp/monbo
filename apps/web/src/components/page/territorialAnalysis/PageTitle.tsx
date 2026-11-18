"use client";

import { useContext, useState } from "react";
import { Text } from "@/components/reusable/Text";
import { useTranslation } from "react-i18next";
import { Box, IconButton } from "@mui/material";
import InfoOutlined from "@mui/icons-material/InfoOutlined";
import { MapsDetailsModal } from "./MapsDetailsModal";
import { useVisibleDataForAnalysisPage } from "@/hooks/useVisibleDataForAnalysisPage";
import { DataContext } from "@/context/DataContext";
import { getCountryName } from "@/utils/countries";

/** The results' title, and how many polygons were crossed with how many layers. */
export const PageTitle: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { selectedCountry } = useContext(DataContext);
  const { farmsData, territorialAnalysisResults } =
    useVisibleDataForAnalysisPage();
  const [open, setOpen] = useState(false);
  const country = selectedCountry
    ? (getCountryName(selectedCountry, i18n.language === "en" ? "en" : "es") ??
      selectedCountry)
    : "";

  return (
    <>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Text variant="h3" bold>
          {t("territorialAnalysis:results.title")}
        </Text>
        <IconButton
          onClick={() => setOpen(true)}
          aria-label={t("territorialAnalysis:mapsInfoModal:title")}
        >
          <InfoOutlined />
        </IconButton>
      </Box>
      <Text sx={{ color: "text.secondary" }}>
        {t("territorialAnalysis:results.subtitle", {
          polygons: t("territorialAnalysis:results.polygonCount", {
            count: farmsData.length,
          }),
          layers: t("territorialAnalysis:results.layerCount", {
            count: territorialAnalysisResults.length,
          }),
          country,
        })}
      </Text>
      <MapsDetailsModal open={open} onClose={() => setOpen(false)} />
    </>
  );
};
