"use client";

import { SearchParamSelector } from "@/components/reusable/inputs/SearchParamSelector";
import { DataContext } from "@/context/DataContext";
import { Box } from "@mui/material";
import { useContext } from "react";
import { Text } from "@/components/reusable/Text";
import { useDeforestationFreeResultsCountByMap } from "@/hooks/useDeforestationFreeResultsCountByMap";
import { DeforestationFreeCounterChip } from "@/components/page/deforestationAnalysis/DeforestationFreeCounterChip";

export const ResultsMapSelector: React.FC = () => {
  const {
    deforestationAnalysisParams: { selectedMaps },
  } = useContext(DataContext);

  const deforestationFreeResultsCountByMap =
    useDeforestationFreeResultsCountByMap();

  return (
    <SearchParamSelector
      searchParamKey="selectedMap"
      options={selectedMaps.map((map) => ({
        label: map.alias,
        value: map.id.toString(),
      }))}
      defaultValue={selectedMaps[0]?.id.toString()}
      style={{
        minWidth: 210,
      }}
      renderOption={(option) => {
        const deforestationFreeCount =
          deforestationFreeResultsCountByMap.find(
            (item) => item.mapId === Number(option.value)
          )?.count ?? null;

        return (
          <Box
            sx={{
              width: "100%",
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <Text>{option.label}</Text>
            <DeforestationFreeCounterChip
              count={deforestationFreeCount}
              sx={{
                marginLeft: 2,
              }}
            />
          </Box>
        );
      }}
    />
  );
};
