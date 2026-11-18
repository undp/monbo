"use client";

import { DataContext } from "@/context/DataContext";
import { useSearch } from "@/hooks/useSearch";
import { useSelectedMap } from "@/hooks/useSelectedMapName";
import { FarmData } from "@/interfaces/Farm";
import { formatResultPercentage, formatNumber } from "@/utils/numbers";
import {
  getResultChipBackgroundColor,
  getResultChipColor,
} from "@/utils/styling";
import { Box, Chip, FormControlLabel, Radio } from "@mui/material";
import { orderBy } from "lodash";
import { useLayerReading } from "@/hooks/useLayerRules";
import { findingRatio } from "@/utils/layerResults";
import { useSearchParams } from "next/navigation";
import { useContext, useMemo } from "react";
import { useTranslation } from "react-i18next";

interface FarmsListProps {
  farmsData: FarmData[];
  selectedValue?: string;
  onChange: (id: string) => void;
}

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

  const selectedMapResults = useMemo(
    () =>
      territorialAnalysisResults?.find(
        (result) => result.mapId === selectedMapId
      ),
    [territorialAnalysisResults, selectedMapId]
  );

  // Largest finding first (`1 − value` for a required layer).
  const sortedData = useMemo(() => {
    return orderBy(
      filteredData,
      (farm) => {
        const layerValue: number | null =
          selectedMapResults?.farmResults.find(
            ({ farmId }) => farmId === farm.id
          )?.value ?? null;
        return layerValue === null || !rule
          ? null
          : findingRatio(layerValue, rule.polarity);
      },
      "desc"
    );
  }, [filteredData, selectedMapResults, rule]);

  return (
    <Box
      sx={{
        overflowX: "hidden",
        paddingLeft: 2,
      }}
    >
      {searchValue === "" && (
        <FormControlLabel
          sx={{ marginBottom: 1, marginTop: 1 }}
          control={
            <Radio
              checked={selectedValue === "all"}
              onChange={() => onChange("all")}
            />
          }
          label={`${t("common:all")} (${formatNumber(
            farmsData?.length || 0,
            0
          )})`}
        />
      )}
      {sortedData.map((farm) => {
        const layerValue: number | null =
          selectedMapResults?.farmResults.find(
            ({ farmId }) => farmId === farm.id
          )?.value ?? null;

        const formattedValue: string =
          layerValue === null || !rule
            ? t("territorialAnalysis:noDataShortText")
            : formatResultPercentage(
                layerValue,
                i18n.language,
                rule
              );
        return (
          <FormControlLabel
            key={farm.id}
            sx={{
              marginBottom: 1,
              width: "100%",
            }}
            slotProps={{
              typography: {
                sx: {
                  width: "100%",
                },
              },
            }}
            control={
              <Radio
                checked={selectedValue === farm.id}
                onChange={() => onChange(farm.id)}
              />
            }
            label={
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 2,
                }}
              >
                {farm.producer} - {farm.id}
                <Chip
                  label={formattedValue}
                  sx={{
                    fontWeight: 500,
                    textTransform: "uppercase",
                    fontSize: 12,
                    minWidth: 60,
                    color: getResultChipColor(
                      layerValue,
                      rule
                    ),
                    backgroundColor:
                      getResultChipBackgroundColor(
                        layerValue,
                        rule
                      ),
                  }}
                />
              </Box>
            }
          />
        );
      })}
    </Box>
  );
};
