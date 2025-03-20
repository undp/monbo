"use client";

import { DataContext } from "@/context/DataContext";
import { useSearch } from "@/hooks/useSearch";
import { useSelectedMap } from "@/hooks/useSelectedMapName";
import { FarmData } from "@/interfaces/Farm";
import { formatNumber, formatPercentage } from "@/utils/numbers";
import {
  getDeforestationPercentageChipBackgroundColor,
  getDeforestationPercentageChipColor,
} from "@/utils/styling";
import { Box, Chip, FormControlLabel, Radio } from "@mui/material";
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
  const { deforestationAnalysisResults } = useContext(DataContext);
  const { t } = useTranslation();

  const searchValue = searchParams.get("search")?.toString() || "";
  const filteredData = useSearch<FarmData>(farmsData || [], searchValue, {
    keys: ["producer", "id"],
  });

  const { id: selectedMapId } = useSelectedMap();

  const deforestationMapResults = useMemo(
    () =>
      deforestationAnalysisResults?.find(
        (result) => result.mapId === selectedMapId
      ),
    [deforestationAnalysisResults, selectedMapId]
  );

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
      {filteredData.map((farm) => {
        const deforestationValue: number | null =
          deforestationMapResults?.farmResults.find(
            ({ farmId }) => farmId === farm.id
          )?.value ?? null;

        const deforestationParsedValue: string =
          deforestationValue === null
            ? t("common:na")
            : formatPercentage(deforestationValue, 1);
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
                  label={deforestationParsedValue}
                  sx={{
                    fontWeight: 500,
                    textTransform: "uppercase",
                    fontSize: 12,
                    minWidth: 60,
                    color:
                      getDeforestationPercentageChipColor(deforestationValue),
                    backgroundColor:
                      getDeforestationPercentageChipBackgroundColor(
                        deforestationValue
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
