"use client";

import { memo, useCallback, useContext, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Box, Checkbox, Tooltip } from "@mui/material";
import CropFreeRoundedIcon from "@mui/icons-material/CropFreeRounded";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useTranslation } from "react-i18next";
import { DataContext } from "@/context/DataContext";
import { useVisibleDataForAnalysisPage } from "@/hooks/useVisibleDataForAnalysisPage";
import { useSearch } from "@/hooks/useSearch";
import type { FarmData } from "@/interfaces/Farm";
import { SearchBar } from "@/components/reusable/inputs/SearchBar";
import { LayerCategoryIcon } from "@/components/reusable/LayerCategoryIcon";
import { FlowSection } from "@/components/page/flow/FlowSection";
import { FLOW_COLORS } from "@/components/page/flow/flowStyles";
import { FLOW_RESULT_PILL, FLOW_TABLE_FRAME, FLOW_TABLE_ID } from "@/components/page/flow/flowTable";
import {
  farmCategoryResults,
  type FarmCategoryResult,
} from "@/utils/farmCategoryResults";
import { layerResult } from "@/utils/layerCategories";
import { layerLabel } from "@/utils/layerLabel";
import { localizedText } from "@/utils/localizedText";
import { formatNumber } from "@/utils/numbers";
import { AS_TEXT } from "@/utils/asText";

/** Every row is one line: the virtual list places them without measuring. */
export const FARM_ROW_HEIGHT = 56;
const LIST_MAX_HEIGHT = 392;
/** Lists longer than this only render the rows in view (and a few around). */
const VIRTUALIZE_FROM = 100;
// Stable, so the search index isn't rebuilt on every render.
const SEARCH_OPTIONS = { keys: ["id", "producer"] };

/** A category's icon in its worst result's colours, with each layer's finding. */
const CategoryResultIcon: React.FC<{ result: FarmCategoryResult }> = ({ result }) => {
  const { t, i18n } = useTranslation();
  const { category, resultClass, layers } = result;
  const name = localizedText(category.name, i18n.language);
  const label =
    resultClass === "unknown"
      ? t("territorialAnalysis:noDataShortText")
      : localizedText(category.resultLabels[resultClass], i18n.language);
  // "GFW 3,42 %", "TMF Libre de deforestación", "IDEAM Sin dato"
  const findings = layers.map(({ layer, value }) => {
    const reading = layerResult(value, category, t, i18n.language);
    const text = reading.resultClass === "flagged" ? reading.findingText : reading.label;
    return `${layerLabel(layer, "short")} ${text}`;
  });
  return (
    // The tooltip describes the icon and keeps its name (category and result).
    // The icons take no focus, so a row stays one Tab stop: its findings are in
    // the icon's name for screen readers.
    <Tooltip
      describeChild
      title={
        <Box component="span" sx={{ display: "block" }}>
          <Box component="strong" sx={{ display: "block" }}>
            {name}
          </Box>
          {findings.join(" · ")}
        </Box>
      }
    >
      <Box
        component="span"
        role="img"
        aria-label={t("reportGeneration:sidebar.categoryResult", {
          category: name,
          result: label,
          findings: findings.join(", "),
          ...AS_TEXT,
        })}
        sx={{
          width: 26,
          height: 26,
          borderRadius: "8px",
          display: "grid",
          placeItems: "center",
          flex: "none",
          ...FLOW_RESULT_PILL[resultClass],
        }}
      >
        <LayerCategoryIcon icon={category.icon} sx={{ fontSize: 16 }} />
      </Box>
    </Tooltip>
  );
};

interface RowProps {
  farm: FarmData;
  checked: boolean;
  results: FarmCategoryResult[];
  onToggle: (farmId: string) => void;
}

const FarmRow = memo<RowProps>(function FarmRow({ farm, checked, results, onToggle }) {
  return (
    <Box
      sx={{
        height: FARM_ROW_HEIGHT,
        display: "flex",
        alignItems: "center",
        gap: 1,
        paddingRight: 1.5,
        borderBottom: `1px solid ${FLOW_COLORS.line}`,
      }}
    >
      <Box
        component="label"
        sx={{
          flex: 1,
          minWidth: 0,
          height: "100%",
          display: "flex",
          alignItems: "center",
          cursor: "pointer",
        }}
      >
        <Checkbox
          size="small"
          checked={checked}
          onChange={() => onToggle(farm.id)}
          // The ID and the producer are two lines: named with a space between
          slotProps={{ input: { "aria-label": `${farm.id} ${farm.producer}` } }}
        />
        <Box sx={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
          <Box component="span" sx={{ ...FLOW_TABLE_ID, fontSize: 14 }}>
            {farm.id}
          </Box>
          <Box
            component="span"
            sx={{
              fontSize: 12.5,
              color: FLOW_COLORS.muted,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {farm.producer}
          </Box>
        </Box>
      </Box>
      <Box sx={{ display: "flex", gap: 0.5, flex: "none" }}>
        {results.map((result) => (
          <CategoryResultIcon key={result.category.id} result={result} />
        ))}
      </Box>
    </Box>
  );
});

/**
 * The report's polygons: a search, "Select all" over the listed ones, and a row per
 * polygon with its checkbox and an icon per category of the ticked layers, coloured
 * with its worst result. Only the rows in view are in the page.
 */
export const ReportFarmList: React.FC = () => {
  const { t } = useTranslation();
  const { farmsData, territorialAnalysisResults } = useVisibleDataForAnalysisPage();
  const {
    reportGenerationParams: { selectedFarms, selectedMaps },
    setReportGenerationParams,
    availableCategories,
  } = useContext(DataContext);
  const search = useSearchParams().get("search") ?? "";
  const listed = useSearch(farmsData, search, SEARCH_OPTIONS);

  const selectedIds = useMemo(
    () => new Set(selectedFarms.map(({ id }) => id)),
    [selectedFarms]
  );
  // Once per results and ticked layers, not per row render
  const resultsByFarm = useMemo(
    () =>
      farmCategoryResults(
        farmsData,
        territorialAnalysisResults,
        selectedMaps,
        availableCategories
      ),
    [farmsData, territorialAnalysisResults, selectedMaps, availableCategories]
  );

  /** The ticked farms, in the analysis's order: the report lists them that way. */
  const setTicked = useCallback(
    (ticked: (ids: Set<string>) => void) =>
      setReportGenerationParams((prev) => {
        const ids = new Set(prev.selectedFarms.map(({ id }) => id));
        ticked(ids);
        return { ...prev, selectedFarms: farmsData.filter(({ id }) => ids.has(id)) };
      }),
    [setReportGenerationParams, farmsData]
  );

  const onToggle = useCallback(
    (farmId: string) =>
      setTicked((ids) => {
        if (!ids.delete(farmId)) ids.add(farmId);
      }),
    [setTicked]
  );

  const tickedListed = listed.filter(({ id }) => selectedIds.has(id)).length;
  const allListed = listed.length > 0 && tickedListed === listed.length;
  const onToggleAll = useCallback(
    () =>
      setTicked((ids) => {
        for (const { id } of listed) {
          if (allListed) ids.delete(id);
          else ids.add(id);
        }
      }),
    [setTicked, listed, allListed]
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualize = listed.length > VIRTUALIZE_FROM;
  // eslint-disable-next-line react-hooks/incompatible-library -- its functions are read during render, never memoized
  const virtualizer = useVirtualizer({
    count: listed.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => FARM_ROW_HEIGHT,
    overscan: 6,
    enabled: virtualize,
    // Before the first measure (and in tests): the list's full height
    initialRect: { width: 0, height: LIST_MAX_HEIGHT },
  });
  // Every row is as tall: a short list is laid out the same way, all in the page.
  const items = virtualize
    ? virtualizer.getVirtualItems()
    : listed.map((_, index) => ({ index, start: index * FARM_ROW_HEIGHT }));

  return (
    <FlowSection
      title={t("reportGeneration:sidebar.farmsTitle")}
      subtitle={t("reportGeneration:sidebar.farmsSubtitle", {
        selected: formatNumber(selectedFarms.length),
        total: formatNumber(farmsData.length),
      })}
      icon={<CropFreeRoundedIcon fontSize="small" />}
      sx={{ padding: { xs: 2, md: "18px 18px" } }}
    >
      <SearchBar
        placeholder={t("reportGeneration:searchPlaceholder")}
        style={{ width: "100%", marginBottom: 1 }}
      />
      <Box
        component="label"
        sx={{
          display: "flex",
          alignItems: "center",
          fontSize: 14,
          fontWeight: 600,
          color: FLOW_COLORS.ink,
          cursor: "pointer",
        }}
      >
        <Checkbox
          size="small"
          checked={allListed}
          indeterminate={tickedListed > 0 && !allListed}
          disabled={listed.length === 0}
          onChange={onToggleAll}
        />
        {t("reportGeneration:sidebar.selectAll", {
          amount: formatNumber(listed.length),
        })}
      </Box>
      <Box
        ref={scrollRef}
        role="group"
        aria-label={t("reportGeneration:sidebar.farmsTitle")}
        sx={{ ...FLOW_TABLE_FRAME, maxHeight: LIST_MAX_HEIGHT }}
      >
        {listed.length === 0 ? (
          <Box sx={{ padding: 2, fontSize: 14, color: FLOW_COLORS.muted }}>
            {t("reportGeneration:sidebar.noMatches")}
          </Box>
        ) : (
          <Box sx={{ height: listed.length * FARM_ROW_HEIGHT, position: "relative" }}>
            {items.map((item) => {
              const farm = listed[item.index];
              return (
                <Box
                  key={farm.id}
                  sx={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${item.start}px)`,
                  }}
                >
                  <FarmRow
                    farm={farm}
                    checked={selectedIds.has(farm.id)}
                    results={resultsByFarm.get(farm.id) ?? []}
                    onToggle={onToggle}
                  />
                </Box>
              );
            })}
          </Box>
        )}
      </Box>
    </FlowSection>
  );
};
