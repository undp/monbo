"use client";

import { DataContext } from "@/context/DataContext";
import { useSearch } from "@/hooks/useSearch";
import { useSelectedMap } from "@/hooks/useSelectedMapName";
import { FarmData } from "@/interfaces/Farm";
import { formatResultPercentage, formatNumber } from "@/utils/numbers";
import { Box, ButtonBase } from "@mui/material";
import { orderBy } from "lodash";
import { useLayerReading } from "@/hooks/useLayerRules";
import { classifyResult, findingRatio } from "@/utils/layerResults";
import { useSearchParams } from "next/navigation";
import { useContext, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { FLOW_COLORS } from "@/components/page/flow/flowStyles";
import { FLOW_RESULT_PILL } from "@/components/page/flow/flowTable";

interface FarmsListProps {
  farmsData: FarmData[];
  selectedValue?: string;
  onChange: (id: string) => void;
}

/**
 * The map's farms, largest finding first: one row each with its ID, its producer
 * and its finding for the selected layer, and "Todos" above them (unless
 * searching). Choosing a row shows that farm alone on the map.
 */
export const FarmsList: React.FC<FarmsListProps> = ({
  farmsData,
  selectedValue,
  onChange,
}) => {
  const searchParams = useSearchParams();
  const { territorialAnalysisResults } = useContext(DataContext);
  const { t, i18n } = useTranslation();

  const searchValue = searchParams.get("search")?.toString() || "";
  const filteredData = useSearch<FarmData>(farmsData || [], searchValue, {
    keys: ["producer", "id"],
  });

  const { id: selectedMapId } = useSelectedMap();
  const { rule } = useLayerReading(selectedMapId);

  const valueByFarm = useMemo(
    () =>
      new Map(
        territorialAnalysisResults
          ?.find((result) => result.mapId === selectedMapId)
          ?.farmResults.map(({ farmId, value }) => [farmId, value])
      ),
    [territorialAnalysisResults, selectedMapId]
  );

  // Largest finding first (`1 − value` for a required layer).
  const sortedData = useMemo(
    () =>
      orderBy(
        filteredData,
        (farm) => {
          const value = valueByFarm.get(farm.id) ?? null;
          return value === null || !rule ? null : findingRatio(value, rule.polarity);
        },
        "desc"
      ),
    [filteredData, valueByFarm, rule]
  );

  return (
    <Box
      role="radiogroup"
      aria-label={t("common:polygons")}
      sx={{ display: "flex", flexDirection: "column", paddingY: 0.5 }}
    >
      {searchValue === "" && (
        <Row
          checked={selectedValue === "all"}
          onSelect={() => onChange("all")}
          label={`${t("common:all")} (${formatNumber(farmsData?.length || 0, 0)})`}
        >
          <Box component="span" sx={{ fontWeight: 600, color: FLOW_COLORS.ink }}>
            {t("common:all")}
          </Box>
          <Box component="span" sx={{ marginLeft: "auto", color: FLOW_COLORS.muted }}>
            {formatNumber(farmsData?.length || 0, 0)}
          </Box>
        </Row>
      )}
      {sortedData.map((farm) => {
        const value = valueByFarm.get(farm.id) ?? null;
        const resultClass = classifyResult(value, rule);
        const finding =
          value === null || !rule
            ? t("territorialAnalysis:noDataShortText")
            : formatResultPercentage(value, i18n.language, rule);
        return (
          <Row
            key={farm.id}
            checked={selectedValue === farm.id}
            onSelect={() => onChange(farm.id)}
            label={`${farm.id} ${farm.producer}`}
          >
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Box
                component="span"
                sx={{
                  display: "block",
                  fontWeight: 600,
                  color: FLOW_COLORS.blue,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {farm.id}
              </Box>
              <Box
                component="span"
                title={farm.producer}
                sx={{
                  display: "block",
                  fontSize: 13,
                  color: FLOW_COLORS.muted,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {farm.producer}
              </Box>
            </Box>
            <Box
              component="span"
              sx={{
                flex: "none",
                padding: "3px 10px",
                borderRadius: "999px",
                fontSize: 12.5,
                fontWeight: 600,
                ...FLOW_RESULT_PILL[resultClass],
              }}
            >
              {finding}
            </Box>
          </Row>
        );
      })}
    </Box>
  );
};

/** A choice of the list: the whole row is the control. */
const Row: React.FC<{
  checked: boolean;
  onSelect: () => void;
  /** What a screen reader announces for the row. */
  label: string;
  children: React.ReactNode;
}> = ({ checked, onSelect, label, children }) => (
  <ButtonBase
    role="radio"
    aria-checked={checked}
    aria-label={label}
    onClick={onSelect}
    sx={{
      display: "flex",
      alignItems: "center",
      justifyContent: "flex-start",
      gap: 1.5,
      width: "100%",
      padding: "10px 14px",
      textAlign: "left",
      fontFamily: "inherit",
      fontSize: 14,
      borderLeft: "3px solid",
      borderLeftColor: checked ? FLOW_COLORS.blue : "transparent",
      backgroundColor: checked ? FLOW_COLORS.blue50 : "transparent",
      transition: "background-color 120ms",
      "&:hover": { backgroundColor: checked ? FLOW_COLORS.blue50 : FLOW_COLORS.blue25 },
      "&.Mui-focusVisible": {
        outline: `2px solid ${FLOW_COLORS.blue}`,
        outlineOffset: -2,
      },
    }}
  >
    {children}
  </ButtonBase>
);
