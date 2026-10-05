"use client";

import React, { useCallback, useContext, useState } from "react";
import { CircleObject, PolygonObject } from "@/components/reusable/Map";
import { RowData, Header } from "@/components/reusable/Table";
import { Text } from "@/components/reusable/Text";
import { BasePolygonModal } from "./BasePolygonModal";
import { InconsistentPolygonData } from "@/interfaces/PolygonValidation";
import { multipleObjectsMapColors } from "@/config/theme";
import {
  parseLatitude,
  parseLongitude,
  parseAreaToHectares,
} from "@/utils/polygons";
import { IconButton, SxProps, Box, Button } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { useTranslation } from "react-i18next";
import { TFunction } from "i18next";
import { DataContext } from "@/context/DataContext";
import { FarmData } from "@/interfaces/Farm";
import { PolygonTypeIcon } from "@/components/reusable/PolygonTypeIcon";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";

const generateHeaders = (t: TFunction<"translation", undefined>) => {
  const headers: Header[] = [
    {
      name: t("polygonValidation:overlapModal.headers.type"),
      attr: "type",
      type: "icon",
      columnStyle: { width: "16%" },
    },
    {
      name: t("polygonValidation:overlapModal.headers.id"),
      attr: "id",
      type: "label",
      columnStyle: { width: "16%" },
    },
    // {
    //   name: t("polygonValidation:overlapModal.headers.producerId"),
    //   attr: "producerId",
    //   type: "label",
    //   columnStyle: { width: "16%" },
    // },
    {
      name: t("polygonValidation:overlapModal.headers.producer"),
      attr: "producer",
      type: "label",
      columnStyle: { width: "45%" },
    },
    {
      name: t("polygonValidation:overlapModal.headers.area"),
      attr: "area",
      type: "label",
      columnStyle: { width: "23%" },
    },
  ];
  return headers;
};

const foldedCellsStyle: SxProps = {
  backgroundColor: "#f9f9f9",
  fontWeight: 500,
  fontSize: 14,
  paddingTop: 0,
  paddingBottom: 0,
  textAlign: "right",
};

const getFoldedRows = (farm: FarmData) => {
  if (farm.polygon.type === "point") {
    return [
      {
        cellStyle: foldedCellsStyle,
        cells: {
          producer: { value: "" },
          producerId: { value: "" },
          type: { value: "1" },
          id: { value: parseLatitude(farm.polygon.details.center.lat) },
          area: {
            value: parseLongitude(farm.polygon.details.center.lng),
          },
        },
      },
    ];
  }
  if (farm.polygon.type === "polygon") {
    return (
      farm.polygon.details?.path?.map((point, idx, array) => ({
        cellStyle: {
          ...foldedCellsStyle,
          ...(idx < array.length - 1
            ? {
                border: 0,
              }
            : {
                paddingBottom: 1,
              }),
        },
        cells: {
          producer: { value: "" },
          producerId: { value: "" },
          type: { value: idx + 1 },
          id: { value: parseLatitude(point.lat) },
          area: { value: parseLongitude(point.lng) },
        },
      })) ?? []
    );
  }
  return [];
};

const generateRows = (
  data: Exclude<InconsistentPolygonData, { type: "overlap" }>,
  farmsData: FarmData[],
  openedRows: string[],
  t: TFunction<"translation", undefined>,
  language: string
): RowData<Exclude<InconsistentPolygonData, { type: "overlap" }>>[] => {
  return data.farmIds.map((farmId, idx) => {
    const farm = farmsData.find((farm) => farm.id === farmId);
    if (!farm) return null;

    return {
      haveActions: true,
      cells: {
        producer: {
          value: (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <FiberManualRecordIcon
                sx={{
                  width: 15,
                  height: 15,
                  color: multipleObjectsMapColors[idx % 2],
                }}
              />
              {farm.producer}
            </Box>
          ),
        },
        // producerId: { value: farm.producerId },
        type: {
          icon: <PolygonTypeIcon polygonType={farm.polygon.type} />,
        },
        id: { value: farm.id },
        area: {
          value: farm.polygon.area
            ? parseAreaToHectares(farm.polygon.area, 2, false, language)
            : t("common:na"),
        },
      },
      data,
      isOpen: openedRows.includes(farm.id),
      cellStyle: {
        border: openedRows.includes(farm.id) ? 0 : undefined,
      },
      foldedRows: [
        {
          cellStyle: { ...foldedCellsStyle, border: 0, paddingTop: 1 },
          cells: {
            producer: { value: "" },
            producerId: { value: "" },
            type: { value: t("common:point") },
            id: { value: t("common:latitude") },
            area: { value: t("common:longitude") },
          },
        },
        ...getFoldedRows(farm),
      ],
    };
  }) as RowData<Exclude<InconsistentPolygonData, { type: "overlap" }>>[];
};
const generateMapObjects = (
  inconsistency: Exclude<InconsistentPolygonData, { type: "overlap" }>,
  farmsData: FarmData[]
): (CircleObject | PolygonObject)[] => {
  const objects: (CircleObject | PolygonObject)[] = inconsistency.farmIds.map(
    (farmId, i) => {
      const farm = farmsData.find((farm) => farm.id === farmId)!;
      if (farm.polygon.type === "point") {
        return {
          id: farmId,
          type: "circle",
          center: farm.polygon.details.center,
          radius: farm.polygon.details.radius,
          color: multipleObjectsMapColors[i % multipleObjectsMapColors.length],
          showPoints: true,
        };
      }
      return {
        id: farmId,
        type: "polygon",
        path: farm.polygon.details?.path ?? [],
        color: multipleObjectsMapColors[i % multipleObjectsMapColors.length],
        showPoints: true,
      };
    }
  );

  return [...objects];
};

interface Props {
  isOpen: boolean;
  handleClose: () => void;
  row: RowData<Exclude<InconsistentPolygonData, { type: "overlap" }>> | null;
}

export const GeometryInconsistencyModal: React.FC<Props> = ({
  isOpen,
  handleClose,
  row,
}) => {
  const { t, i18n } = useTranslation();
  const [openedRows, setOpenedRows] = useState<string[]>([]);
  const { farmsData } = useContext(DataContext);

  const headers = generateHeaders(t);

  const handleModalClose = useCallback(() => {
    setOpenedRows([]);
    handleClose();
  }, [handleClose]);

  return (
    <BasePolygonModal
      size="xl"
      title={
        <Text variant="h6" bold>
          {t("polygonValidation:geometryInconsistencyModal.title")}
        </Text>
      }
      hideCloseButton
      isOpen={isOpen}
      row={row}
      handleClose={handleModalClose}
      rowsGenerator={(row) =>
        generateRows(row, farmsData ?? [], openedRows, t, i18n.language)
      }
      mapObjectsGenerator={(row) => generateMapObjects(row, farmsData ?? [])}
      mapCenter={{ lat: 0, lng: 0 }}
      tableTitle={
        <Text variant="body1" bold>
          {t("polygonValidation:geometryInconsistencyModal.tableTitle")}
        </Text>
      }
      tableProps={{
        headers,
        actions: (item, idx) => (
          <IconButton
            onClick={() =>
              setOpenedRows((prev) => {
                if (!item.data) return prev;
                if (prev.includes(item.data?.farmIds[idx])) {
                  return prev.filter((id) => id !== item.data?.farmIds[idx]);
                }
                return [item.data?.farmIds[idx]]; // Include ...prev if want to keep the previous state
              })
            }
          >
            {openedRows.includes(item.data!.farmIds[idx]) ? (
              <ExpandLessIcon />
            ) : (
              <ExpandMoreIcon />
            )}
          </IconButton>
        ),
      }}
      footer={
        <Box
          sx={{
            marginTop: 3,
            display: "flex",
            justifyContent: "flex-end",
            gap: 2,
            backgroundColor: "white",
          }}
        >
          <Button variant="contained" onClick={handleModalClose}>
            {t("common:close")}
          </Button>
        </Box>
      }
    >
      <Box
        sx={{
          mt: 2,
          display: "flex",
          flexDirection: "column",
          gap: 2,
          p: 1,
        }}
      >
        <Text variant="body1" bold>
          {t("polygonValidation:geometryInconsistencyModal.contentTitle")}
        </Text>
        <Text variant="body2">
          {t(`polygonValidation:inconsistenciesTypes:${row?.data?.type}`)}
        </Text>
        {!!row?.data?.data?.reason && (
          <Text variant="body2">
            {t("polygonValidation:geometryInconsistencyModal.systemFeedback")}:{" "}
            {row?.data?.data?.reason}
          </Text>
        )}
      </Box>
    </BasePolygonModal>
  );
};
