"use client";

import { useContext, useMemo } from "react";
import { Box } from "@mui/material";
import { useTranslation } from "react-i18next";
import { DataContext } from "@/context/DataContext";
import { useVisibleDataForAnalysisPage } from "@/hooks/useVisibleDataForAnalysisPage";
import { summarizeCategories, type ResultClass } from "@/utils/layerResults";
import { localizedText } from "@/utils/localizedText";
import { categoryTints } from "@/utils/categoryColors";
import { formatNumber } from "@/utils/numbers";
import { LayerCategoryIcon } from "@/components/reusable/LayerCategoryIcon";
import { FLOW_COLORS, HEADING_FONT } from "@/components/page/flow/flowStyles";

const METER_ORDER: ResultClass[] = ["ok", "flagged", "unknown"];
// As the mockup: green for the farms without findings, a soft red for the rest
const METER_COLORS: Record<ResultClass, string> = {
  ok: FLOW_COLORS.ok,
  flagged: "result.meterFlagged",
  unknown: "result.meterUnknown",
};

/**
 * One card per analysed category: how many of the visible farms are ok, have
 * findings or have no data in it, a farm counting once per category (see
 * summarizeCategories).
 */
export const CategorySummaryCards: React.FC = () => {
  const { t, i18n } = useTranslation();
  const {
    availableCategories,
    territorialAnalysisParams: { selectedMaps },
  } = useContext(DataContext);
  const { farmsData, territorialAnalysisResults } =
    useVisibleDataForAnalysisPage();

  const summaries = useMemo(
    () =>
      summarizeCategories(
        farmsData,
        territorialAnalysisResults,
        selectedMaps,
        availableCategories
      ),
    [farmsData, territorialAnalysisResults, selectedMaps, availableCategories]
  );

  if (!summaries.length) return null;
  const total = farmsData.length;

  return (
    <Box
      component="ul"
      aria-label={t("territorialAnalysis:results.summaryLabel")}
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
              border: `1px solid ${FLOW_COLORS.line}`,
              borderRadius: "14px",
              backgroundColor: FLOW_COLORS.white,
              boxShadow: "0 1px 2px rgba(11, 37, 69, 0.04)",
              padding: "18px 20px",
              display: "flex",
              flexDirection: "column",
              gap: 1.25,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
              <Box
                aria-hidden
                sx={{
                  width: 36,
                  height: 36,
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
                sx={{
                  fontFamily: HEADING_FONT,
                  fontWeight: 700,
                  fontSize: 16,
                  color: FLOW_COLORS.ink,
                }}
              >
                {name}
              </Box>
              <Box
                component="span"
                sx={{ marginLeft: "auto", fontSize: 13, color: FLOW_COLORS.muted }}
              >
                {t("territorialAnalysis:results.layerCount", {
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
                  fontSize: 30,
                  lineHeight: 1,
                  color: FLOW_COLORS.ink,
                }}
              >
                {t("territorialAnalysis:results.okOfTotal", {
                  ok: formatNumber(counts.ok, 0),
                  total: formatNumber(total, 0),
                })}
              </Box>{" "}
              <Box component="span" sx={{ fontSize: 15, color: FLOW_COLORS.ink2 }}>
                {localizedText(category.resultLabels.ok, i18n.language)}
              </Box>
            </Box>
            <Box
              aria-hidden
              sx={{
                height: 8,
                borderRadius: "999px",
                overflow: "hidden",
                display: "flex",
                backgroundColor: FLOW_COLORS.blue50,
              }}
            >
              {METER_ORDER.map((resultClass) => (
                <Box
                  key={resultClass}
                  data-result-class={resultClass}
                  sx={{
                    width: `${total ? (100 * counts[resultClass]) / total : 0}%`,
                    backgroundColor: METER_COLORS[resultClass],
                  }}
                />
              ))}
            </Box>
            <Box sx={{ fontSize: 13, color: FLOW_COLORS.muted }}>
              {t("territorialAnalysis:results.flaggedAndNoData", {
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
