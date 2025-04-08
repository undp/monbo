"use client";

import {
  CellData,
  Header,
  RowData,
  Table,
  TableProps,
} from "@/components/reusable/Table";
import { DataContext, DataContextValue } from "@/context/DataContext";
import { useSearch } from "@/hooks/useSearch";
import { useSortedTable } from "@/hooks/useSortedTable";
import { FarmData } from "@/interfaces/Farm";
import { formatDeforestationPercentage } from "@/utils/numbers";
import { removeDiacritics } from "@/utils/strings";
import { orderBy } from "lodash";
import { useSearchParams } from "next/navigation";
import { useContext, useMemo } from "react";
import { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { useVisibleDataForDeforestationPage } from "@/hooks/useVisibleDataForDeforestationPage";
import { useDeforestationFreeResultsCountByMap } from "@/hooks/useDeforestationFreeResultsCountByMap";
import { DeforestationFreeCounterChip } from "@/components/page/deforestationAnalysis/DeforestationFreeCounterChip";
import { PolygonTypeIcon } from "@/components/reusable/PolygonTypeIcon";
import { FarmValidationStatus } from "@/interfaces/PolygonValidation";
import {
  getDeforestationPercentageChipBackgroundColor,
  getDeforestationPercentageChipColor,
} from "@/utils/styling";

const parseRows = (
  data: FarmData[],
  deforestationAnalysisResults: NonNullable<
    DataContextValue["deforestationAnalysisResults"]
  >,
  polygonsValidationResults: DataContextValue["polygonsValidationResults"],
  t: TFunction<"translation", undefined>,
  language: string
): RowData<FarmData>[] => {
  return data.map((farm) => ({
    cells: {
      id: { value: farm.id },
      producer: { value: farm.producer },
      type: {
        icon: (
          <PolygonTypeIcon
            polygonType={farm.polygon.type}
            isValidManually={
              polygonsValidationResults?.farmResults.find(
                ({ farmId }) => farmId === farm.id
              )?.status === FarmValidationStatus.VALID_MANUALLY
            }
          />
        ),
      },
      cropType: { value: farm.cropType },
      ...deforestationAnalysisResults.reduce<Record<string, CellData>>(
        (acc, current) => {
          const farmResultValue =
            current.farmResults.find(({ farmId }) => farmId === farm.id)
              ?.value ?? null;
          return {
            ...acc,
            [`map_${current.mapId}`]: {
              value:
                farmResultValue === null
                  ? t("common:na")
                  : farmResultValue === 0
                  ? t("deforestationAnalysis:deforestationFreeShortText")
                  : `${formatDeforestationPercentage(
                      farmResultValue,
                      language
                    )} Def.`,
              chipStyle: {
                width: 100,
                color: getDeforestationPercentageChipColor(farmResultValue),
                backgroundColor:
                  getDeforestationPercentageChipBackgroundColor(
                    farmResultValue
                  ),
              },
            },
          };
        },
        {}
      ),
    },
  }));
};

interface Props {
  tableProps?: Partial<TableProps<FarmData>>;
  mapsSubset?: Set<number>;
}

export const DeforestationResultsTable: React.FC<Props> = ({
  tableProps,
  mapsSubset,
}) => {
  const { availableMaps, polygonsValidationResults } = useContext(DataContext);
  const {
    farmsData,
    deforestationAnalysisResults: originalDeforestationAnalysisResults,
  } = useVisibleDataForDeforestationPage();

  const searchParams = useSearchParams();
  const searchValue = searchParams.get("search");
  const { t, i18n } = useTranslation();

  const [sortedBy, setSortedBy] = useSortedTable();

  const deforestationFreeResultsCountByMap =
    useDeforestationFreeResultsCountByMap();

  const filteredData = useSearch(farmsData, searchValue ?? "", {
    keys: ["id", "producer"],
  });

  const deforestationAnalysisResults = useMemo(() => {
    if (!mapsSubset) return originalDeforestationAnalysisResults;
    return originalDeforestationAnalysisResults?.filter((m) =>
      mapsSubset.has(m.mapId)
    );
  }, [originalDeforestationAnalysisResults, mapsSubset]);

  const sortedData: FarmData[] = useMemo(() => {
    if (!sortedBy) return filteredData;

    const results = orderBy(
      filteredData.map((item) => {
        const allIdsAreNumbers = filteredData.every(
          ({ id }) => !isNaN(Number(id))
        );
        return {
          ...item,
          id: allIdsAreNumbers ? Number(item.id) : item.id,
          producer: removeDiacritics(item.producer),
          _producer: item.producer,
          ...deforestationAnalysisResults?.reduce<
            Record<string, number | null>
          >((acc, current) => {
            acc[`map_${current.mapId}`] =
              current.farmResults.find(({ farmId }) => farmId === item.id)
                ?.value ?? null;
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
  }, [filteredData, sortedBy, deforestationAnalysisResults]);

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
            <DeforestationFreeCounterChip count={current.count} />
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

  // TODO: search some nice message into Table when no results found of text searching
  return (
    <Table
      {...tableProps}
      headerStyle={{ backgroundColor: "#FFFFFF" }}
      headers={[
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
        ...deforestationAnalysisResults.map<Header>((m) => ({
          name: availableMaps.find(({ id }) => id === m.mapId)?.alias,
          attr: `map_${m!.mapId}`,
          type: "chip",
          sortable: true,
          columnStyle: {
            textAlign: "center",
            ...(deforestationAnalysisResults.length > 1
              ? {
                  width: `${60 / deforestationAnalysisResults.length}%`,
                  maxWidth: "20%",
                }
              : { width: "20%" }),
            ...(m!.mapId === 0
              ? { backgroundColor: "#F3FAFD", padding: "16px 24px" }
              : {}),
          },
          ...(m!.mapId === 0
            ? {
                chip: {
                  label: t("deforestationAnalysis:euOfficialMap"),
                  sx: {
                    color: "white",
                    backgroundColor: "#03689E",
                  },
                },
              }
            : {}),
        })),
      ]}
      rows={parseRows(
        sortedData,
        deforestationAnalysisResults,
        polygonsValidationResults,
        t,
        i18n.language
      )}
      footerStyle={{ backgroundColor: "#FFFFFF70" }}
      footerCellStyle={{ backgroundColor: "#FFFFFF70" }}
      footer={footer}
      sortedBy={sortedBy}
      sortBy={setSortedBy}
    />
  );
};
