"use client";

import { useContext, useMemo, useState } from "react";
import { RowData, Table } from "@/components/reusable/Table";
import { flatMap, flatten, orderBy } from "lodash";
import {
  FarmValidationStatus,
  InconsistentPolygonData,
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

const colorByCritically: Record<
  InconsistentPolygonData["data"]["criticality"],
  string
> = {
  HIGH: "#C62828",
  MEDIUM: "#ED6C02",
};

const dataParser = (
  data: InconsistentPolygonData[],
  farmsData: FarmData[],
  polygonsValidationResults: ValidateFarmsResponse,
  hasTheSameProductionUnit: boolean,
  language: string
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

      const percentage = item.data.percentage;

      const entry: RowData<InconsistentPolygonData> = {
        haveActions: idx === 0,
        rowStyle: {
          // color: isFarmValidManually ? "#3A354166" : undefined,
          opacity: isFarmValidManually ? 0.4 : 1,
        },
        cells: {
          type: {
            icon: (
              <PolygonTypeIcon
                polygonType={farm.polygon.type}
                isValidManually={isFarmValidManually}
              />
            ),
            cellStyle: {
              opacity: 1,
            },
          },
          id: { value: farmId },
          producer: { value: farm.producer },
          cropType: { value: farm.cropType },
          production: {
            value: hasTheSameProductionUnit
              ? farm.production
              : `${farm.production} ${farm.productionQuantityUnit}`,
          },
          ...(idx === 0
            ? {
                overlapPercentage: {
                  value: formatOverlapPercentage(percentage, language),
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
                  value: parseAreaToHectares(
                    item.data.area,
                    2,
                    false,
                    language
                  ),
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
              }
            : {}),
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
    () =>
      polygonsValidationResults?.inconsistencies.filter(
        ({ type }) => type === "overlap"
      ) ?? [],
    [polygonsValidationResults]
  );

  const filteredPolygons = useSearch<InconsistentPolygonData>(
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
  const sortedPolygons = useMemo(
    () =>
      sortedBy
        ? orderBy(
            filteredPolygons.map((item) => {
              return {
                ...item,
                overlapPercentage: item.data.percentage,
                overlapArea: item.data.area,
              };
            }),
            sortedBy.attr,
            sortedBy.order
          )
        : filteredPolygons,
    [sortedBy, filteredPolygons]
  );

  if (sortedPolygons?.length === 0)
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
            columnStyle: { textAlign: "right", paddingRight: "5%" },
          },
        ]}
        headerStyle={{ backgroundColor: "#fff" }}
        rows={dataParser(
          sortedPolygons,
          farmsData ?? [],
          polygonsValidationResults!,
          hasTheSameProductionUnit,
          i18n.language
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
