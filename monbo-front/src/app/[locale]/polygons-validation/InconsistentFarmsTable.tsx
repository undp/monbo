"use client";

import { useContext, useMemo, useState } from "react";
import { CellData, RowData, Table } from "@/components/reusable/Table";
import { flatMap, flatten, orderBy } from "lodash";
import {
  FarmValidationStatus,
  InconsistentPolygonData,
  OverlapData,
  ValidateFarmsResponse,
} from "@/interfaces/PolygonValidation";
import { useSearchParams } from "next/navigation";
import { PolygonInconsistencyModal } from "@/components/page/polygonsValidation/PolygonInconsistencyModal";
import { DataContext } from "@/context/DataContext";
import { formatOverlapPercentage } from "@/utils/numbers";
import { useTranslation } from "react-i18next";
import { Box } from "@mui/material";
import { Text } from "@/components/reusable/Text";
import { MomboIcon } from "@/components/icons/MomboIcon";
import { useSortedTable } from "@/hooks/useSortedTable";
import { parseAreaToHectares } from "@/utils/polygons";
import { FarmData } from "@/interfaces/Farm";
import { useSearch } from "@/hooks/useSearch";
import { PolygonTypeIcon } from "@/components/reusable/PolygonTypeIcon";
import { TFunction } from "i18next";

const colorByCritically: Record<OverlapData["criticality"], string> = {
  HIGH: "#C62828",
  MEDIUM: "#ED6C02",
};

const getItemInconsistencyCellValue = (
  item: InconsistentPolygonData,
  idx: number,
  t: TFunction<"translation", undefined>
): Record<string, CellData> => {
  if (item.type === "overlap") {
    if (idx === 0) {
      return {
        inconsistency: {
          value: t(`polygonValidation:inconsistenciesTypes:${item.type}`),
          rowSpan: item.farmIds.length,
          cellStyle: {
            opacity: 1,
          },
        },
      };
    }
    return {};
  }
  return {
    inconsistency: {
      value: t(`polygonValidation:inconsistenciesTypes:${item.type}`),
      cellStyle: {
        opacity: 1,
      },
    },
  };
};

const getOverlapColumnsCellsValue = (
  item: InconsistentPolygonData,
  idx: number,
  language: string,
  areAllFarmsValidManually: boolean
): Record<string, CellData> => {
  if (item.type !== "overlap")
    return {
      overlapPercentage: {
        value: null,
      },
      overlapArea: {
        value: null,
      },
    };
  if (idx !== 0) return {};

  return {
    overlapPercentage: {
      value: formatOverlapPercentage(item.data.percentage, language),
      rowSpan: item.farmIds.length,
      chipStyle: {
        color: areAllFarmsValidManually ? "#3A3541" : "#fff",
        backgroundColor: areAllFarmsValidManually
          ? "#3A354150"
          : colorByCritically[item.data.criticality],
        width: 80,
      },
      cellStyle: {
        ...(!areAllFarmsValidManually && {
          opacity: 1,
        }),
      },
    },
    overlapArea: {
      value: parseAreaToHectares(item.data.area, 2, false, language),
      rowSpan: item.farmIds.length,
      cellStyle: {
        paddingRight: "calc(5% + 26px)",
        ...(!areAllFarmsValidManually && {
          color: "#3A3541",
          opacity: 1,
        }),
      },
    },
    actions: {
      rowSpan: item.farmIds.length,
    },
  };
};

const dataParser = (
  data: InconsistentPolygonData[],
  farmsData: FarmData[],
  polygonsValidationResults: ValidateFarmsResponse,
  hasTheSameProductionUnit: boolean,
  language: string,
  t: TFunction<"translation", undefined>
): RowData<InconsistentPolygonData>[] => {
  const rows = flatMap(data, (item) =>
    item.farmIds.map((farmId, idx) => {
      const farm: FarmData = farmsData.find(({ id }) => id === farmId)!;
      const isFarmValidManually =
        polygonsValidationResults.farmResults.find((f) => farmId === f.farmId)
          ?.status === FarmValidationStatus.VALID_MANUALLY;

      const areAllFarmsValidManually = item.farmIds.every(
        (farmId) =>
          polygonsValidationResults.farmResults.find((f) => farmId === f.farmId)
            ?.status === FarmValidationStatus.VALID_MANUALLY
      );

      const entry: RowData<InconsistentPolygonData> = {
        haveActions: idx === 0,
        rowStyle: {
          // color: isFarmValidManually ? "#3A354166" : undefined,
          opacity: isFarmValidManually ? 0.4 : 1,
        },
        cells: {
          ...getItemInconsistencyCellValue(item, idx, t),
          type: {
            icon: (
              <PolygonTypeIcon
                polygonType={farm.polygon.type}
                isValidManually={isFarmValidManually}
              />
            ),
          },
          id: { value: farmId },
          producer: { value: farm.producer },
          cropType: { value: farm.cropType },
          production: {
            value: hasTheSameProductionUnit
              ? farm.production
              : `${farm.production} ${farm.productionQuantityUnit}`,
          },
          ...getOverlapColumnsCellsValue(
            item,
            idx,
            language,
            areAllFarmsValidManually
          ),
        },
        data: item,
      };
      return entry;
    })
  );
  return rows;
};

export const InconsistentFarmsTable: React.FC = () => {
  const { farmsData, polygonsValidationResults } = useContext(DataContext);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPolygon, setSelectedPolygon] =
    useState<RowData<InconsistentPolygonData> | null>(null);

  const searchParams = useSearchParams();
  const searchValue = searchParams.get("search")?.toString() || "";

  const { t, i18n } = useTranslation();
  const [sortedBy, setSortedBy] = useSortedTable();

  const hasTheSameProductionUnit = useMemo(
    () =>
      farmsData?.every(
        (farm) =>
          farm.productionQuantityUnit === farmsData?.[0].productionQuantityUnit
      ) ?? false,
    [farmsData]
  );

  const inconsistencies = useMemo(
    () => polygonsValidationResults?.inconsistencies ?? [],
    [polygonsValidationResults]
  );

  const filteredInconsistencies = useSearch<InconsistentPolygonData>(
    inconsistencies,
    searchValue,
    {
      keys: ["id", "producer"],
      // TODO: check if there are performance problems defining this arrow fn
      getFn: (item, path) => {
        const relatedFarms = item.farmIds.map((farmId) =>
          farmsData?.find(({ id }) => farmId === id)
        );
        if (typeof path === "string") {
          return relatedFarms.map((farm) =>
            String(farm?.[path as keyof FarmData] ?? "")
          );
        } else {
          return flatten(
            relatedFarms.map((farm) =>
              path.map((field) => String(farm?.[field as keyof FarmData] ?? ""))
            )
          );
        }
      },
    }
  );

  // Sort the filtered polygons based on the selected sort criteria
  // - Calculate total area of all polygons in the group
  // - Calculate overlap percentage as: overlap area / (total area - overlap area)
  // - Add overlap area as separate field for display
  // - If no sort criteria selected, return original filtered data
  const sortedInconsistencies = useMemo(
    () =>
      sortedBy
        ? orderBy(
            filteredInconsistencies.map((item) => {
              const inconsistency = t(
                `polygonValidation:inconsistenciesTypes:${item.type}`
              );
              if (item.type === "overlap") {
                return {
                  ...item,
                  inconsistency,
                  overlapPercentage: item.data.percentage,
                  overlapArea: item.data.area,
                };
              }
              return {
                ...item,
                inconsistency,
              };
            }),
            sortedBy.attr,
            sortedBy.order
          )
        : filteredInconsistencies,
    [sortedBy, filteredInconsistencies, t]
  );

  if (sortedInconsistencies?.length === 0)
    return (
      <>
        <Box
          sx={{
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            gap: 2,
          }}
        >
          <MomboIcon sx={{ fontSize: 64 }} />
          <Text variant="h3" bold>
            {t("polygonValidation:noInconsistencies")}
          </Text>
        </Box>
      </>
    );

  return (
    <>
      <Table
        headers={[
          {
            name: t("common:tableColumns:type"),
            attr: "type",
            type: "icon",
          },
          {
            name: "Id",
            attr: "id",
            type: "label",
            columnStyle: { textAlign: "center" },
          },
          {
            name: t("common:tableColumns:producer"),
            attr: "producer",
            type: "label",
          },
          {
            name: t("common:tableColumns:cropType"),
            attr: "cropType",
            type: "label",
          },
          {
            name: hasTheSameProductionUnit
              ? `${t("common:tableColumns:production")} (${
                  farmsData?.[0].productionQuantityUnit
                })`
              : t("common:tableColumns:production"),
            attr: "production",
            type: "label",
            columnStyle: { textAlign: "right" },
          },
          {
            name: t("common:tableColumns:inconsistency"),
            attr: "inconsistency",
            type: "label",
            sortable: true,
          },
          {
            name: t("common:tableColumns:overlap"),
            attr: "overlapPercentage",
            type: "chip",
            sortable: true,
            columnStyle: { textAlign: "center" },
          },
          {
            name: t("common:tableColumns:overlapArea"),
            attr: "overlapArea",
            type: "label",
            sortable: true,
            columnStyle: {
              textAlign: "right",
              paddingRight: "5%",
            },
          },
        ]}
        headerStyle={{ backgroundColor: "#fff" }}
        rows={dataParser(
          sortedInconsistencies,
          farmsData ?? [],
          polygonsValidationResults!,
          hasTheSameProductionUnit,
          i18n.language,
          t
        )}
        onRowClick={(row) => {
          setSelectedPolygon(row);
          setIsModalOpen(true);
        }}
        sortedBy={sortedBy}
        sortBy={setSortedBy}
      />
      <PolygonInconsistencyModal
        isOpen={isModalOpen}
        handleClose={() => setIsModalOpen(false)}
        row={selectedPolygon}
      />
    </>
  );
};
