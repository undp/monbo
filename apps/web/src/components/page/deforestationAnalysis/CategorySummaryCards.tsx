"use client";

import { useContext, useMemo } from "react";
import { Box } from "@mui/material";
import { useTranslation } from "react-i18next";
import { DataContext } from "@/context/DataContext";
import { useVisibleDataForDeforestationPage } from "@/hooks/useVisibleDataForDeforestationPage";
import { summarizeCategories, type ResultClass } from "@/utils/layerResults";
import { localizedText } from "@/utils/localizedText";
import { categoryTints } from "@/utils/categoryColors";
import { resultClassColor } from "@/utils/styling";
import { formatNumber } from "@/utils/numbers";
import { LayerCategoryIcon } from "@/components/reusable/LayerCategoryIcon";
import { HEADING_FONT } from "@/components/page/flow/flowStyles";

const METER_ORDER: ResultClass[] = ["ok", "flagged", "unknown"];

/**
 * One card per analysed category: how many of the visible farms are ok, have
 * findings or have no data in it, a farm counting once per category (see
 * summarizeCategories).
 */
export const CategorySummaryCards: React.FC = () => {
  const { t, i18n } = useTranslation();
  const {
    availableCategories,
    deforestationAnalysisParams: { selectedMaps },
  } = useContext(DataContext);
  const { farmsData, deforestationAnalysisResults } =
    useVisibleDataForDeforestationPage();

  const summaries = useMemo(
    () =>
      summarizeCategories(
        farmsData,
        deforestationAnalysisResults,
        selectedMaps,
        availableCategories
      ),
    [farmsData, deforestationAnalysisResults, selectedMaps, availableCategories]
  );

  if (!summaries.length) return null;
  const total = farmsData.length;

  return (
    <Box
      component="ul"
      aria-label={t("deforestationAnalysis:results.summaryLabel")}
      sx={{
        listStyle: "none",
        margin: 0,
        padding: 0,
        display: "grid",
        gap: 1.5,
        gridTemplateColumns: {
          xs: "1fr",
          sm: "repeat(auto-fit, minmax(240px, 1fr))",
        },
      }}
    >
      {summaries.map(({ category, layerIds, counts }) => {
        const tints = categoryTints(category.color);
        const name = localizedText(category.name, i18n.language);
        return (
          <Box
            component="li"
            key={category.id}
            aria-label={name}
            sx={{
              border: "1px solid #DEDEDE",
              borderRadius: 3.5,
              backgroundColor: "#FFFFFF",
              padding: 2,
              display: "flex",
              flexDirection: "column",
              gap: 1.25,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
              <Box
                aria-hidden
                sx={{
                  width: 32,
                  height: 32,
                  flex: "none",
                  borderRadius: 2.5,
                  display: "grid",
                  placeItems: "center",
                  backgroundColor: tints.background,
                  color: tints.color,
                }}
              >
                <LayerCategoryIcon icon={category.icon} sx={{ fontSize: 20 }} />
              </Box>
              <Box
                component="span"
                sx={{ fontFamily: HEADING_FONT, fontWeight: 700, fontSize: 15 }}
              >
                {name}
              </Box>
              <Box
                component="span"
                sx={{ marginLeft: "auto", fontSize: 12, color: "text.secondary" }}
              >
                {t("deforestationAnalysis:results.layerCount", {
                  count: layerIds.length,
                })}
              </Box>
            </Box>
            <Box>
              <Box
                component="span"
                sx={{
                  fontFamily: HEADING_FONT,
                  fontWeight: 800,
                  fontSize: 26,
                  lineHeight: 1,
                }}
              >
                {t("deforestationAnalysis:results.okOfTotal", {
                  ok: formatNumber(counts.ok, 0),
                  total: formatNumber(total, 0),
                })}
              </Box>{" "}
              <Box component="span" sx={{ fontSize: 14, color: "text.secondary" }}>
                {localizedText(category.resultLabels.ok, i18n.language)}
              </Box>
            </Box>
            <Box
              aria-hidden
              sx={{
                height: 8,
                borderRadius: 2,
                overflow: "hidden",
                display: "flex",
                backgroundColor: "#EEEEEE",
              }}
            >
              {METER_ORDER.map((resultClass) => (
                <Box
                  key={resultClass}
                  sx={{
                    width: `${total ? (100 * counts[resultClass]) / total : 0}%`,
                    backgroundColor:
                      resultClass === "unknown"
                        ? "#BDBDBD"
                        : resultClassColor(resultClass),
                  }}
                />
              ))}
            </Box>
            <Box sx={{ fontSize: 13, color: "text.secondary" }}>
              {t("deforestationAnalysis:results.flaggedAndNoData", {
                flagged: formatNumber(counts.flagged, 0),
                unknown: formatNumber(counts.unknown, 0),
              })}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
};
