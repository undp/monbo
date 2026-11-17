"use client";

import { SearchParamSelector } from "@/components/reusable/inputs/SearchParamSelector";
import { DataContext } from "@/context/DataContext";
import { Box } from "@mui/material";
import { useContext, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Text } from "@/components/reusable/Text";
import { useDeforestationFreeResultsCountByMap } from "@/hooks/useDeforestationFreeResultsCountByMap";
import { DeforestationFreeCounterChip } from "@/components/page/deforestationAnalysis/DeforestationFreeCounterChip";
import { LayerCategoryIcon } from "@/components/reusable/LayerCategoryIcon";
import { layerLabel } from "@/utils/layerLabel";
import { groupLayersByCategory } from "@/utils/layerResults";
import { localizedText } from "@/utils/localizedText";
import { categoryTints } from "@/utils/categoryColors";

/** The map's layer, chosen among the analysed layers grouped by category. */
export const ResultsMapSelector: React.FC = () => {
  const { t, i18n } = useTranslation();
  const {
    deforestationAnalysisParams: { selectedMaps },
    availableCategories,
  } = useContext(DataContext);

  const deforestationFreeResultsCountByMap =
    useDeforestationFreeResultsCountByMap();

  const options = useMemo(
    () =>
      groupLayersByCategory(selectedMaps, availableCategories).flatMap(
        ({ category, layers }) => {
          const group = {
            key: category?.id ?? "uncategorized",
            label: (
              <Box
                component="span"
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 0.75,
                  color: categoryTints(category?.color).color,
                  fontWeight: 700,
                }}
              >
                <LayerCategoryIcon icon={category?.icon} sx={{ fontSize: 18 }} />
                {category
                  ? localizedText(category.name, i18n.language)
                  : t("deforestationAnalysis:categories.uncategorized")}
              </Box>
            ),
          };
          return layers.map((map) => ({
            label: layerLabel(map, "short"),
            value: map.id.toString(),
            group,
          }));
        }
      ),
    [selectedMaps, availableCategories, i18n.language, t]
  );

  return (
    <SearchParamSelector
      searchParamKey="selectedMap"
      options={options}
      defaultValue={selectedMaps[0]?.id.toString()}
      style={{
        minWidth: 210,
      }}
      renderOption={(option) => {
        const counter = deforestationFreeResultsCountByMap.find(
          (item) => item.mapId === Number(option.value)
        );

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
              count={counter?.count ?? null}
              category={counter?.category ?? null}
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
