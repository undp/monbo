"use client";

import { Table, RowData } from "@/components/reusable/Table";
import { PolygonDetailModal } from "@/components/page/polygonsValidation/PolygonDetailModal";
import { useContext, useEffect, useMemo, useState } from "react";
import { FarmData } from "@/interfaces/Farm";
import { useRouter, useSearchParams } from "next/navigation";
import { orderBy } from "lodash";
import { useTranslation } from "react-i18next";
import { Box } from "@mui/material";
import { Text } from "@/components/reusable/Text";
import { useSortedTable } from "@/hooks/useSortedTable";
import { removeDiacritics } from "@/utils/strings";
import { MomboIcon } from "@/components/icons/MomboIcon";
import { useValidFarmsDataForValidationPage } from "@/hooks/useValidFarmsDataForValidationPage";
import { useSearch } from "@/hooks/useSearch";
import { DataContext } from "@/context/DataContext";
import {
  FarmValidationStatus,
  ValidateFarmsResponse,
} from "@/interfaces/PolygonValidation";
import { PolygonTypeIcon } from "@/components/reusable/PolygonTypeIcon";

const dataParser = (
  data: FarmData[],
  polygonsValidationResults: ValidateFarmsResponse
): RowData<FarmData>[] => {
  return data.map((farm) => {
    const isValidManually =
      polygonsValidationResults.farmResults.find(
        ({ farmId }) => farmId === farm.id
      )?.status === FarmValidationStatus.VALID_MANUALLY;
    return {
      haveActions: false,
      cells: {
        type: {
          icon: (
            <PolygonTypeIcon
              polygonType={farm.polygon.type}
              isValidManually={isValidManually}
            />
          ),
        },
        id: { value: farm.id },
        producer: { value: farm.producer },
        cropType: { value: farm.cropType },
        production: {
          value: farm.production,
          cellStyle: { paddingRight: "calc(5% + 26px)" },
        },
      },
      data: farm,
    };
  });
};

export const ValidFarmsTable: React.FC = () => {
  const { polygonsValidationResults } = useContext(DataContext);
  const { farmsData: validFarmsData } = useValidFarmsDataForValidationPage();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedFarm, setSelectedFarm] = useState<RowData<FarmData> | null>(
    null
  );
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchValue = searchParams.get("search")?.toString() || "";
  const { t } = useTranslation();

  const [sortedBy, setSortedBy] = useSortedTable();

  useEffect(() => {
    if (!validFarmsData) {
      router.push("/");
    }
  }, [validFarmsData, router]);

  const filteredPolygons = useSearch<FarmData>(validFarmsData, searchValue, {
    keys: ["id", "producer"],
  });

  // Sort the filtered polygons based on the selected sort criteria
  // - If all IDs are numbers, cast them to numbers for proper numeric sorting
  // - Remove diacritics from producer names for proper alphabetical sorting
  // - Store original producer name to restore it after sorting
  // - Restore IDs as strings for typing consistency
  const sortedPolygons: FarmData[] = useMemo(() => {
    if (!sortedBy) return filteredPolygons;

    const results = orderBy(
      filteredPolygons.map((item) => {
        const allIdsAreNumbers = filteredPolygons.every(
          ({ id }) => !isNaN(Number(id))
        );
        return {
          ...item,
          id: allIdsAreNumbers ? Number(item.id) : item.id,
          producer: removeDiacritics(item.producer),
          _producer: item.producer,
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
  }, [filteredPolygons, sortedBy]);

  if (sortedPolygons.length === 0)
    return (
      <Box
        sx={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 2,
        }}
      >
        <MomboIcon sx={{ fontSize: 64 }} />
        <Text variant="h3" bold>
          {t("polygonValidation:noResults")}
        </Text>
      </Box>
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
            sortable: true,
            columnStyle: { textAlign: "center" },
          },
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
          {
            name: t("common:tableColumns:production"),
            attr: "production",
            type: "label",
            sortable: true,
            columnStyle: { textAlign: "right", paddingRight: "5%" },
          },
        ]}
        headerStyle={{ backgroundColor: "#fff" }}
        rows={dataParser(sortedPolygons, polygonsValidationResults!)}
        onRowClick={(item) => {
          setIsModalOpen(true);
          setSelectedFarm(item);
        }}
        sortedBy={sortedBy}
        sortBy={setSortedBy}
      />
      <PolygonDetailModal
        isOpen={isModalOpen}
        handleClose={() => setIsModalOpen(false)}
        row={selectedFarm}
      />
    </>
  );
};
