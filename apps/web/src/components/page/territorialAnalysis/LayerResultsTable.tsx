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
import type { MapData } from "@/interfaces/LayerAnalysis";
import { layerResultText } from "@/utils/resultLabels";
import { removeDiacritics } from "@/utils/strings";
import { orderBy } from "lodash";
import { useSearchParams } from "next/navigation";
import { useContext, useMemo } from "react";
import { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { Box } from "@mui/material";
import { useVisibleDataForAnalysisPage } from "@/hooks/useVisibleDataForAnalysisPage";
import { useNoObservationsCountByMap } from "@/hooks/useNoObservationsCountByMap";
import { useLayerRules, type LayerReading } from "@/hooks/useLayerRules";
import { NoObservationsCounterChip } from "@/components/page/territorialAnalysis/NoObservationsCounterChip";
import { PolygonTypeIcon } from "@/components/reusable/PolygonTypeIcon";
import { LayerCategoryIcon } from "@/components/reusable/LayerCategoryIcon";
import { FarmValidationStatus } from "@/interfaces/PolygonValidation";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import {
  classifyResult,
  findingRatio,
  groupLayersByCategory,
} from "@/utils/layerResults";
import { FLOW_RESULT_PILL, FLOW_TABLE_ID } from "@/components/page/flow/flowTable";
import { layerLabel } from "@/utils/layerLabel";
import { localizedText } from "@/utils/localizedText";
import { categoryTints } from "@/utils/categoryColors";

type Results = NonNullable<DataContextValue["territorialAnalysisResults"]>;

/** Each layer's results by farm id: one lookup per cell instead of a scan. */
const indexResults = (results: Results) =>
  new Map(
    results.map((layer) => [
      layer.mapId,
      new Map(layer.farmResults.map(({ farmId, value }) => [farmId, value])),
    ])
  );

// A result pill: the class's color on its tint. Category labels can be long: the
// pill wraps them instead of widening the column.
const RESULT_CHIP_SX = {
  height: "auto",
  maxWidth: 220,
  borderRadius: "999px",
  textTransform: "none",
  fontSize: 13,
  fontWeight: 600,
  "& .MuiChip-label": {
    display: "inline-flex",
    alignItems: "center",
    gap: 0.5,
    whiteSpace: "normal",
    textAlign: "center",
    paddingY: 0.5,
    paddingX: 1.25,
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
  language: string,
  compact: boolean
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
      id: {
        value: compact ? (
          <Box component="span" sx={FLOW_TABLE_ID}>
            {farm.id}
          </Box>
        ) : (
          farm.id
        ),
      },
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
        const resultClass = classifyResult(value, rule);
        const text = layerResultText(value, category, t, language);
        acc[`map_${layer.id}`] = {
          value:
            resultClass === "ok" ? (
              <>
                <CheckRoundedIcon sx={{ fontSize: 16 }} aria-hidden />
                {text}
              </>
            ) : (
              text
            ),
          chipStyle: { ...RESULT_CHIP_SX, ...FLOW_RESULT_PILL[resultClass] },
        };
        return acc;
      }, {}),
    },
  }));
};

// Stable, so the search index isn't rebuilt on every render.
const SEARCH_OPTIONS = { keys: ["id", "producer"] };

// The farm columns before the layer columns: ID and producer on stage 2, and
// also the kind and the crop on the report stage.
const FARM_COLUMNS = { compact: 2, full: 4 } as const;

interface Props {
  /** "compact" (stage 2): ID and producer; "full" (the report): also kind and crop. */
  farmColumns?: keyof typeof FARM_COLUMNS;
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
export const LayerResultsTable: React.FC<Props> = ({
  farmColumns = "full",
  tableProps,
  mapsSubset,
}) => {
  const compact = farmColumns === "compact";
  const {
    polygonsValidationResults,
    availableCategories,
    territorialAnalysisParams: { selectedMaps },
  } = useContext(DataContext);
  const {
    farmsData,
    territorialAnalysisResults: originalTerritorialAnalysisResults,
  } = useVisibleDataForAnalysisPage();
  const readLayer = useLayerRules();

  const searchParams = useSearchParams();
  const searchValue = searchParams.get("search");
  const { t, i18n } = useTranslation();

  const [sortedBy, setSortedBy] = useSortedTable();

  const noObservationsCountByMap =
    useNoObservationsCountByMap();

  const filteredData = useSearch(farmsData, searchValue ?? "", SEARCH_OPTIONS);

  const territorialAnalysisResults = useMemo(() => {
    if (!mapsSubset) return originalTerritorialAnalysisResults;
    return originalTerritorialAnalysisResults?.filter((m) =>
      mapsSubset.has(m.mapId)
    );
  }, [originalTerritorialAnalysisResults, mapsSubset]);

  // The analysed layers, by category (the API's order), then by id.
  const groups = useMemo(
    () =>
      groupLayersByCategory(
        selectedMaps.filter(({ id }) =>
          territorialAnalysisResults.some(({ mapId }) => mapId === id)
        ),
        availableCategories
      ),
    [selectedMaps, territorialAnalysisResults, availableCategories]
  );
  const layers = useMemo(() => groups.flatMap(({ layers }) => layers), [groups]);
  const groupStarts = useMemo(
    () => new Set(groups.map(({ layers }) => layers[0].id)),
    [groups]
  );

  const sortedData: FarmData[] = useMemo(() => {
    if (!sortedBy) return filteredData;

    const allIdsAreNumbers = filteredData.every(({ id }) => !isNaN(Number(id)));
    const resultsByMap = indexResults(territorialAnalysisResults ?? []);
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
  }, [filteredData, sortedBy, territorialAnalysisResults, layers, readLayer]);

  const footer = useMemo<TableProps<FarmData>["footer"]>(() => {
    if (!territorialAnalysisResults || !!searchValue) return undefined;

    return {
      type: null,
      id: null,
      cropType: null,
      ...noObservationsCountByMap.reduce(
        (acc, current) => ({
          ...acc,
          [current.attr]: (
            <NoObservationsCounterChip
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
    territorialAnalysisResults,
    noObservationsCountByMap,
  ]);

  const headers = useMemo<Header[]>(
    () => [
      ...(compact
        ? []
        : [
            {
              name: t("common:tableColumns:type"),
              attr: "type",
              type: "icon" as const,
              columnStyle: { width: 100 },
            },
          ]),
      {
        name: "ID",
        attr: "id",
        type: "label",
        sortable: true,
        ...(compact && { columnStyle: { width: "1%", whiteSpace: "nowrap" } }),
      },
      {
        name: t("common:tableColumns:producer"),
        attr: "producer",
        type: "label",
        sortable: true,
      },
      ...(compact
        ? []
        : [
            {
              name: t("common:tableColumns:cropType"),
              attr: "cropType",
              type: "label" as const,
              sortable: true,
            },
          ]),
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
    [t, layers, groupStarts, compact]
  );

  const headerGroups = useMemo<HeaderGroup[]>(
    () => [
      { key: "farm", span: FARM_COLUMNS[farmColumns] },
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
                : t("territorialAnalysis:categories.uncategorized")}
            </Box>
          ),
        };
      }),
    ],
    [groups, i18n.language, t, farmColumns]
  );

  // Memoized, so the table's rows only re-render when they change (selection
  // clicks re-render only the checkboxes).
  const rows = useMemo(
    () =>
      parseRows(
        sortedData,
        layers,
        territorialAnalysisResults,
        readLayer,
        polygonsValidationResults,
        t,
        i18n.language,
        compact
      ),
    [
      compact,
      sortedData,
      layers,
      territorialAnalysisResults,
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
