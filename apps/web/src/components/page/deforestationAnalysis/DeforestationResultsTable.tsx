"use client";

import {
  CellData,
  Header,
  HeaderGroup,
  RowData,
  Table,
  TableProps,
} from "@/components/reusable/Table";
import { DataContext, DataContextValue } from "@/context/DataContext";
import { useSearch } from "@/hooks/useSearch";
import { useSortedTable } from "@/hooks/useSortedTable";
import { FarmData } from "@/interfaces/Farm";
import type { MapData } from "@/interfaces/DeforestationAnalysis";
import { layerResultText } from "@/utils/resultLabels";
import { removeDiacritics } from "@/utils/strings";
import { orderBy } from "lodash";
import { useSearchParams } from "next/navigation";
import { useContext, useMemo } from "react";
import { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { Box } from "@mui/material";
import { useVisibleDataForDeforestationPage } from "@/hooks/useVisibleDataForDeforestationPage";
import { useDeforestationFreeResultsCountByMap } from "@/hooks/useDeforestationFreeResultsCountByMap";
import { useLayerRules, type LayerReading } from "@/hooks/useLayerRules";
import { DeforestationFreeCounterChip } from "@/components/page/deforestationAnalysis/DeforestationFreeCounterChip";
import { PolygonTypeIcon } from "@/components/reusable/PolygonTypeIcon";
import { LayerCategoryIcon } from "@/components/reusable/LayerCategoryIcon";
import { FarmValidationStatus } from "@/interfaces/PolygonValidation";
import {
  getDeforestationPercentageChipBackgroundColor,
  getDeforestationPercentageChipColor,
} from "@/utils/styling";
import { findingRatio, groupLayersByCategory } from "@/utils/layerResults";
import { layerLabel } from "@/utils/layerLabel";
import { localizedText } from "@/utils/localizedText";
import { categoryTints } from "@/utils/categoryColors";

type Results = NonNullable<DataContextValue["deforestationAnalysisResults"]>;

/** Each layer's results by farm id: one lookup per cell instead of a scan. */
const indexResults = (results: Results) =>
  new Map(
    results.map((layer) => [
      layer.mapId,
      new Map(layer.farmResults.map(({ farmId, value }) => [farmId, value])),
    ])
  );

// Category labels can be long: the chip wraps them instead of widening the column.
const RESULT_CHIP_SX = {
  height: "auto",
  maxWidth: 200,
  textTransform: "none",
  "& .MuiChip-label": {
    whiteSpace: "normal",
    textAlign: "center",
    paddingY: 0.5,
  },
};

// A line between categories.
const GROUP_START_SX = { borderLeft: "1px solid", borderLeftColor: "divider" };

const parseRows = (
  data: FarmData[],
  layers: MapData[],
  results: Results,
  readLayer: (layerId: number) => LayerReading,
  polygonsValidationResults: DataContextValue["polygonsValidationResults"],
  t: TFunction<"translation", undefined>,
  language: string
): RowData<FarmData>[] => {
  const resultsByMap = indexResults(results);
  const statusByFarm = new Map(
    polygonsValidationResults?.farmResults.map(({ farmId, status }) => [
      farmId,
      status,
    ])
  );
  return data.map((farm) => ({
    cells: {
      id: { value: farm.id },
      producer: { value: farm.producer },
      type: {
        icon: (
          <PolygonTypeIcon
            polygonType={farm.polygon.type}
            isValidManually={
              statusByFarm.get(farm.id) === FarmValidationStatus.VALID_MANUALLY
            }
          />
        ),
      },
      cropType: { value: farm.cropType },
      ...layers.reduce<Record<string, CellData>>((acc, layer) => {
        const { category, rule } = readLayer(layer.id);
        const value = resultsByMap.get(layer.id)?.get(farm.id) ?? null;
        acc[`map_${layer.id}`] = {
          value: layerResultText(value, category, t, language),
          chipStyle: {
            ...RESULT_CHIP_SX,
            color: getDeforestationPercentageChipColor(value, rule),
            backgroundColor: getDeforestationPercentageChipBackgroundColor(
              value,
              rule
            ),
          },
        };
        return acc;
      }, {}),
    },
  }));
};

// Stable, so the search index isn't rebuilt on every render.
const SEARCH_OPTIONS = { keys: ["id", "producer"] };

// The farm columns before the layer columns.
const FARM_COLUMNS = 4;

interface Props {
  /** Passed to the generic table: the report stage makes the rows selectable. */
  tableProps?: Partial<TableProps<FarmData>>;
  /** Only these layers' columns (the report's layers); every analysed layer otherwise. */
  mapsSubset?: Set<number>;
}

/**
 * The analysis results: a row per visible farm and a column per layer, the layer
 * columns grouped under their category. Each cell reads its layer's result with the
 * layer's category. Used by stage 2 and, with `tableProps` and `mapsSubset`, by the
 * report stage.
 */
export const DeforestationResultsTable: React.FC<Props> = ({
  tableProps,
  mapsSubset,
}) => {
  const {
    polygonsValidationResults,
    availableCategories,
    deforestationAnalysisParams: { selectedMaps },
  } = useContext(DataContext);
  const {
    farmsData,
    deforestationAnalysisResults: originalDeforestationAnalysisResults,
  } = useVisibleDataForDeforestationPage();
  const readLayer = useLayerRules();

  const searchParams = useSearchParams();
  const searchValue = searchParams.get("search");
  const { t, i18n } = useTranslation();

  const [sortedBy, setSortedBy] = useSortedTable();

  const deforestationFreeResultsCountByMap =
    useDeforestationFreeResultsCountByMap();

  const filteredData = useSearch(farmsData, searchValue ?? "", SEARCH_OPTIONS);

  const deforestationAnalysisResults = useMemo(() => {
    if (!mapsSubset) return originalDeforestationAnalysisResults;
    return originalDeforestationAnalysisResults?.filter((m) =>
      mapsSubset.has(m.mapId)
    );
  }, [originalDeforestationAnalysisResults, mapsSubset]);

  // The analysed layers, by category (the API's order), then by id.
  const groups = useMemo(
    () =>
      groupLayersByCategory(
        selectedMaps.filter(({ id }) =>
          deforestationAnalysisResults.some(({ mapId }) => mapId === id)
        ),
        availableCategories
      ),
    [selectedMaps, deforestationAnalysisResults, availableCategories]
  );
  const layers = useMemo(() => groups.flatMap(({ layers }) => layers), [groups]);
  const groupStarts = useMemo(
    () => new Set(groups.map(({ layers }) => layers[0].id)),
    [groups]
  );

  const sortedData: FarmData[] = useMemo(() => {
    if (!sortedBy) return filteredData;

    const allIdsAreNumbers = filteredData.every(({ id }) => !isNaN(Number(id)));
    const resultsByMap = indexResults(deforestationAnalysisResults ?? []);
    const results = orderBy(
      filteredData.map((item) => {
        return {
          ...item,
          id: allIdsAreNumbers ? Number(item.id) : item.id,
          producer: removeDiacritics(item.producer),
          _producer: item.producer,
          // Layer columns sort by finding, so a required layer's worst farms
          // come together with an avoid layer's.
          ...layers.reduce<Record<string, number | null>>((acc, layer) => {
            const { rule } = readLayer(layer.id);
            const value = resultsByMap.get(layer.id)?.get(item.id) ?? null;
            acc[`map_${layer.id}`] =
              value === null || !rule ? null : findingRatio(value, rule.polarity);
            return acc;
          }, {}),
        };
      }),
      sortedBy.attr,
      sortedBy.order
    );
    return results.map((item) => ({
      ...item,
      id: String(item.id),
      producer: item._producer,
    }));
  }, [filteredData, sortedBy, deforestationAnalysisResults, layers, readLayer]);

  const footer = useMemo<TableProps<FarmData>["footer"]>(() => {
    if (!deforestationAnalysisResults || !!searchValue) return undefined;

    return {
      type: null,
      id: null,
      cropType: null,
      ...deforestationFreeResultsCountByMap.reduce(
        (acc, current) => ({
          ...acc,
          [current.attr]: (
            <DeforestationFreeCounterChip
              count={current.count}
              category={current.category}
            />
          ),
        }),
        {}
      ),
    };
  }, [
    searchValue,
    deforestationAnalysisResults,
    deforestationFreeResultsCountByMap,
  ]);

  const headers = useMemo<Header[]>(
    () => [
      {
        name: t("common:tableColumns:type"),
        attr: "type",
        type: "icon",
        columnStyle: { width: 100 },
      },
      { name: "Id", attr: "id", type: "label", sortable: true },
      {
        name: t("common:tableColumns:producer"),
        attr: "producer",
        type: "label",
        sortable: true,
      },
      {
        name: t("common:tableColumns:cropType"),
        attr: "cropType",
        type: "label",
        sortable: true,
      },
      ...layers.map<Header>((layer) => ({
        name: layerLabel(layer, "short"),
        attr: `map_${layer.id}`,
        type: "chip",
        sortable: true,
        columnStyle: {
          textAlign: "center",
          minWidth: 150,
          ...(groupStarts.has(layer.id) ? GROUP_START_SX : {}),
        },
      })),
    ],
    [t, layers, groupStarts]
  );

  const headerGroups = useMemo<HeaderGroup[]>(
    () => [
      { key: "farm", span: FARM_COLUMNS },
      ...groups.map(({ category, layers }) => {
        const { color } = categoryTints(category?.color);
        return {
          key: category?.id ?? "uncategorized",
          span: layers.length,
          sx: { ...GROUP_START_SX, textAlign: "center" },
          label: (
            <Box
              component="span"
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.75,
                color,
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
      }),
    ],
    [groups, i18n.language, t]
  );

  // Memoized, so the table's rows only re-render when they change (selection
  // clicks re-render only the checkboxes).
  const rows = useMemo(
    () =>
      parseRows(
        sortedData,
        layers,
        deforestationAnalysisResults,
        readLayer,
        polygonsValidationResults,
        t,
        i18n.language
      ),
    [
      sortedData,
      layers,
      deforestationAnalysisResults,
      readLayer,
      polygonsValidationResults,
      t,
      i18n.language,
    ]
  );

  // TODO: search some nice message into Table when no results found of text searching
  return (
    <Table
      {...tableProps}
      headerStyle={{ backgroundColor: "#FFFFFF" }}
      headers={headers}
      headerGroups={headerGroups}
      rows={rows}
      footerStyle={{ backgroundColor: "#FFFFFF70" }}
      footerCellStyle={{ backgroundColor: "#FFFFFF70" }}
      footer={footer}
      sortedBy={sortedBy}
      sortBy={setSortedBy}
    />
  );
};
