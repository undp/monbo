"use client";

import { SearchBar } from "@/components/reusable/inputs/SearchBar";
import { Box, ButtonBase } from "@mui/material";
import { Suspense, useCallback, useMemo, useState } from "react";
import { FarmsList } from "@/components/page/territorialAnalysis/FarmsList";
import { SelectedPolygonsMap } from "@/components/page/territorialAnalysis/SelectedPolygonsMap";
import { useTranslation } from "react-i18next";
import { useSelectedMap } from "@/hooks/useSelectedMapName";
import { useVisibleDataForAnalysisPage } from "@/hooks/useVisibleDataForAnalysisPage";
import { useSearchParams } from "next/navigation";
import { groupFarmsByResult, type ResultClass } from "@/utils/layerResults";
import { useLayerReading } from "@/hooks/useLayerRules";
import { localizedText } from "@/utils/localizedText";
import { categoryTints } from "@/utils/categoryColors";
import { LayerCategoryIcon } from "@/components/reusable/LayerCategoryIcon";
import { FLOW_COLORS } from "@/components/page/flow/flowStyles";
import { FLOW_RESULT_PILL } from "@/components/page/flow/flowTable";

/**
 * The results on the map, for the layer chosen in the section's header: at the
 * left the farms, filtered by their result for that layer (with findings, without,
 * no data) or by the search; at the right the map, with the layer's legend over
 * it. Choosing a farm shows it alone on the map.
 */
export const MapView: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [selectedPolygonIdAtList, setSelectedPolygonIdAtList] =
    useState<string>("all");
  const [selectedPolygonIdAtMap, setSelectedPolygonIdAtMap] = useState<
    string | null
  >(null);
  const [group, setGroup] = useState<ResultClass>("flagged");

  const {
    id: selectedMapId,
    name: selectedMapName,
    baseline,
    comparedAgainst,
  } = useSelectedMap();
  const { category, rule } = useLayerReading(selectedMapId);

  const { farmsData, territorialAnalysisResults } =
    useVisibleDataForAnalysisPage();

  const searchParams = useSearchParams();
  const searchValue = searchParams.get("search");

  // A farm without a result for this layer (or with a null one, or a layer whose
  // category is missing) is "no data", never ok.
  const farmsByResult = useMemo(
    () =>
      groupFarmsByResult(
        farmsData,
        territorialAnalysisResults?.find(
          (result) => result.mapId === selectedMapId
        ),
        rule
      ),
    [farmsData, territorialAnalysisResults, selectedMapId, rule]
  );

  // The groups are named with the layer's category labels. "No data" only shows
  // when it has farms; a layer without them falls back to the first group.
  const groups = useMemo(
    () =>
      [
        {
          id: "flagged" as const,
          label: category
            ? localizedText(category.resultLabels.flagged, i18n.language)
            : t("territorialAnalysis:results.flagged"),
        },
        {
          id: "ok" as const,
          label: category
            ? localizedText(category.resultLabels.ok, i18n.language)
            : t("territorialAnalysis:results.ok"),
        },
        { id: "unknown" as const, label: t("territorialAnalysis:noDataShortText") },
      ].filter(({ id }) => id !== "unknown" || farmsByResult.unknown.length > 0),
    [category, i18n.language, t, farmsByResult.unknown.length]
  );
  const shownGroup = groups.some(({ id }) => id === group) ? group : "flagged";

  const onPolygonListClick = useCallback((id: string) => {
    setSelectedPolygonIdAtList(id);
    // The farm chosen in the list is the one shown on the map
    setSelectedPolygonIdAtMap(id === "all" ? null : id);
  }, []);

  const onGroupChange = useCallback((next: ResultClass) => {
    setGroup(next);
    setSelectedPolygonIdAtList("all");
    setSelectedPolygonIdAtMap(null);
  }, []);

  const categoryName = category
    ? localizedText(category.name, i18n.language)
    : t("territorialAnalysis:categories.uncategorized");

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: { xs: "column", md: "row" },
        height: "100%",
        minHeight: 0,
      }}
    >
      <Box
        sx={{
          flex: { xs: "0 0 auto", md: "0 0 320px" },
          maxHeight: { xs: 320, md: "none" },
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          borderRight: { md: `1px solid ${FLOW_COLORS.line}` },
          borderBottom: { xs: `1px solid ${FLOW_COLORS.line}`, md: "none" },
          backgroundColor: FLOW_COLORS.white,
        }}
      >
        <Box sx={{ padding: "14px 14px 10px" }}>
          <Suspense>
            <SearchBar
              placeholder={t("territorialAnalysis:searchPlaceholder")}
              style={{ width: "100%" }}
            />
          </Suspense>
          {!searchValue && (
            // Filters of the list below: each one shows its farms
            <Box
              role="group"
              aria-label={t("territorialAnalysis:mapFilters")}
              sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, marginTop: 1.25 }}
            >
              {groups.map(({ id, label }) => {
                const selected = shownGroup === id;
                const count = farmsByResult[id].length;
                return (
                  <ButtonBase
                    key={id}
                    aria-pressed={selected}
                    aria-label={`${label} (${count})`}
                    onClick={() => onGroupChange(id)}
                    sx={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 0.75,
                      padding: "5px 10px",
                      borderRadius: "999px",
                      fontFamily: "inherit",
                      fontSize: 13,
                      fontWeight: selected ? 600 : 500,
                      textAlign: "left",
                      border: "1px solid",
                      borderColor: selected
                        ? FLOW_RESULT_PILL[id].color
                        : FLOW_COLORS.line,
                      color: selected ? FLOW_RESULT_PILL[id].color : FLOW_COLORS.ink2,
                      backgroundColor: selected
                        ? FLOW_RESULT_PILL[id].backgroundColor
                        : FLOW_COLORS.white,
                      "&.Mui-focusVisible": {
                        outline: `2px solid ${FLOW_COLORS.blue}`,
                        outlineOffset: 2,
                      },
                    }}
                  >
                    {label}
                    <Box component="b" sx={{ fontWeight: 700 }}>
                      {count}
                    </Box>
                  </ButtonBase>
                );
              })}
            </Box>
          )}
        </Box>
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            borderTop: `1px solid ${FLOW_COLORS.line}`,
          }}
        >
          <FarmsList
            farmsData={searchValue ? farmsData : farmsByResult[shownGroup]}
            selectedValue={selectedPolygonIdAtList}
            onChange={onPolygonListClick}
          />
        </Box>
      </Box>

      <Box
        sx={{
          flex: { xs: "none", md: 1 },
          minWidth: 0,
          height: { xs: 360, md: "auto" },
          minHeight: { md: 0 },
          position: "relative",
        }}
      >
        <SelectedPolygonsMap
          farmsData={farmsData}
          allPolygonsSelected={selectedPolygonIdAtList === "all"}
          selectedPolygonIdAtMap={selectedPolygonIdAtMap}
          setSelectedPolygonIdAtMap={setSelectedPolygonIdAtMap}
        />
        {/* The layer's legend, over the map's free corner */}
        <Box
          aria-label={t("territorialAnalysis:mapLegend")}
          role="note"
          sx={{
            position: "absolute",
            top: 12,
            right: 12,
            maxWidth: "min(320px, calc(100% - 24px))",
            padding: "10px 14px",
            borderRadius: "12px",
            backgroundColor: "rgba(255, 255, 255, 0.95)",
            boxShadow: "0 4px 16px rgba(11, 37, 69, 0.18)",
            fontSize: 13,
            color: FLOW_COLORS.ink2,
            pointerEvents: "none",
          }}
        >
          <Box sx={{ fontWeight: 600, fontSize: 14, color: FLOW_COLORS.ink }}>
            {selectedMapName}
          </Box>
          {baseline !== null && comparedAgainst !== null && (
            <Box>
              {t("territorialAnalysis:mapFooter", {
                baselineYear: baseline,
                comparedToYear: comparedAgainst,
              })}
            </Box>
          )}
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, marginTop: 0.75 }}>
            <Box
              aria-hidden
              sx={{
                width: 12,
                height: 12,
                flex: "none",
                borderRadius: "3px",
                // The API paints the tiles red whatever the category
                backgroundColor: "result.layerTile",
              }}
            />
            <Box
              component="span"
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.5,
                fontWeight: 600,
                color: categoryTints(category?.color).color,
              }}
            >
              <LayerCategoryIcon icon={category?.icon} sx={{ fontSize: 16 }} />
              {categoryName}
            </Box>
          </Box>
          <Box sx={{ marginTop: 0.75, fontSize: 11.5, color: FLOW_COLORS.muted }}>
            {t("territorialAnalysis:satelliteImageryDisclaimer")}
          </Box>
        </Box>
      </Box>
    </Box>
  );
};
