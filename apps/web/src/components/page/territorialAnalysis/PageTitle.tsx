"use client";

import { useContext, useState } from "react";
import { useTranslation } from "react-i18next";
import { Box, IconButton } from "@mui/material";
import InfoOutlined from "@mui/icons-material/InfoOutlined";
import { FlowPageHead } from "@/components/page/flow/FlowPageHead";
import { FLOW_COLORS } from "@/components/page/flow/flowStyles";
import { MapsDetailsModal } from "./MapsDetailsModal";
import { useVisibleDataForAnalysisPage } from "@/hooks/useVisibleDataForAnalysisPage";
import { DataContext } from "@/context/DataContext";
import { getCountryName } from "@/utils/countries";

/**
 * The results' head: "Etapa 2 de 3", the title and how many polygons were crossed
 * with how many layers, with the page's actions at the right (changing the layers,
 * the download) after the button to the layers' details.
 */
export const PageTitle: React.FC<{ actions?: React.ReactNode }> = ({ actions }) => {
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
      <FlowPageHead
        title={t("territorialAnalysis:results.title")}
        subtitle={t("territorialAnalysis:results.subtitle", {
          polygons: t("territorialAnalysis:results.polygonCount", {
            count: farmsData.length,
          }),
          layers: t("territorialAnalysis:results.layerCount", {
            count: territorialAnalysisResults.length,
          }),
          country,
        })}
        actions={
          <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1.25 }}>
            <IconButton
              onClick={() => setOpen(true)}
              aria-label={t("territorialAnalysis:mapsInfoModal:title")}
              sx={{ color: FLOW_COLORS.blue }}
            >
              <InfoOutlined />
            </IconButton>
            {actions}
          </Box>
        }
      />
      <MapsDetailsModal open={open} onClose={() => setOpen(false)} />
    </>
  );
};
