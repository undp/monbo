"use client";

import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { CircleObject, PolygonObject } from "@/components/reusable/Map";
import { RowData, Header } from "@/components/reusable/Table";
import { Text } from "@/components/reusable/Text";
import { BasePolygonModal } from "./BasePolygonModal";
import {
  FarmValidationStatus,
  InconsistentPolygonData,
} from "@/interfaces/PolygonValidation";
import { multipleObjectsMapColors, issueMapColor } from "@/config/theme";
import {
  parsePolygonArea,
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
import { SnackbarContext } from "@/context/SnackbarContext";
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
      columnStyle: { width: "24%" },
    },
    {
      name: t("polygonValidation:overlapModal.headers.area"),
      attr: "area",
      type: "label",
      columnStyle: { width: "16%" },
    },
  ];
  return headers;
};

const generateRows = (
  data: InconsistentPolygonData,
  farmsData: FarmData[],
  selectedRows: string[],
  openedRows: string[],
  t: TFunction<"translation", undefined>
) => {
  const foldedCellsStyle: SxProps = {
    backgroundColor: "#f9f9f9",
    fontWeight: 500,
    fontSize: 14,
    paddingTop: 0,
    paddingBottom: 0,
    textAlign: "right",
  };
  return data.farmIds.map((farmId, idx) => {
    const farm = farmsData.find((farm) => farm.id === farmId);
    if (!farm) return null;

    const isValidManually = selectedRows.includes(farmId);
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
          icon: (
            <PolygonTypeIcon
              polygonType={farm.polygon.type}
              isValidManually={isValidManually}
            />
          ),
        },
        id: { value: farm.id },
        area: { value: parseAreaToHectares(farm.polygon.area, 2, false) },
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
        ...(farm.polygon.type === "point"
          ? [
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
            ]
          : farm.polygon.details.path.map((point, idx, array) => ({
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
            }))),
      ],
    };
  }) as RowData<InconsistentPolygonData>[];
};
const generateMapObjects = (
  data: InconsistentPolygonData,
  farmsData: FarmData[]
): (CircleObject | PolygonObject)[] => {
  const objects: (CircleObject | PolygonObject)[] = data.farmIds.map(
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
        path: farm.polygon.details.path,
        color: multipleObjectsMapColors[i % multipleObjectsMapColors.length],
        showPoints: true,
      };
    }
  );
  const overlap: PolygonObject = {
    id: "overlap",
    type: "polygon",
    path: data.data.path,
    color: issueMapColor,
    fill: true,
  };
  return [...objects, overlap];
};

interface PolygonDetailModalProps {
  isOpen: boolean;
  handleClose: () => void;
  row: RowData<InconsistentPolygonData> | null;
}
export const PolygonInconsistencyModal: React.FC<PolygonDetailModalProps> = ({
  isOpen,
  handleClose,
  row,
}) => {
  return row?.data?.type === "overlap" ? (
    <OverlapModal isOpen={isOpen} handleClose={handleClose} row={row} />
  ) : null;
};

const OverlapModal: React.FC<PolygonDetailModalProps> = ({
  isOpen,
  handleClose,
  row,
}) => {
  const { t } = useTranslation();
  const [openedRows, setOpenedRows] = useState<string[]>([]);
  const { farmsData, polygonsValidationResults, setPolygonsValidationResults } =
    useContext(DataContext);
  const { openSnackbar } = useContext(SnackbarContext);

  const selectedRows = useMemo<string[]>(() => {
    if (!row?.data) return [];
    return row.data.farmIds.filter(
      (id) =>
        polygonsValidationResults?.farmResults.find((fr) => fr.farmId === id)
          ?.status === FarmValidationStatus.VALID_MANUALLY
    );
  }, [polygonsValidationResults, row]);

  const unselectedRows = useMemo<string[]>(() => {
    if (!row?.data) return [];
    return row.data.farmIds.filter(
      (id) =>
        polygonsValidationResults?.farmResults.find((fr) => fr.farmId === id)
          ?.status !== FarmValidationStatus.VALID_MANUALLY
    );
  }, [polygonsValidationResults, row]);

  const prevValidationResultsRef = useRef(polygonsValidationResults);

  const polygonsAmount = row?.data?.farmIds.length || 0;
  const overlapArea = row?.data?.data.area || 0;

  const area = parsePolygonArea(overlapArea);

  const headers = generateHeaders(t);

  const toggleSelectedRows = useCallback(
    (ids: string[]) => {
      setPolygonsValidationResults((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          farmResults: prev.farmResults.map((fr) => {
            if (!ids.includes(fr.farmId)) return fr;
            return {
              ...fr,
              status:
                fr.status === FarmValidationStatus.VALID_MANUALLY
                  ? FarmValidationStatus.NOT_VALID
                  : FarmValidationStatus.VALID_MANUALLY,
            };
          }),
        };
      });
    },
    [setPolygonsValidationResults]
  );

  const handleModalClose = useCallback(() => {
    setOpenedRows([]);
    handleClose();
  }, [handleClose]);

  // Show snackbar when farm status change
  useEffect(() => {
    if (!polygonsValidationResults) return;

    const prevResults = prevValidationResultsRef.current;
    if (!prevResults) return;

    // Find farms that changed status
    polygonsValidationResults.farmResults.forEach((farm) => {
      const prevFarm = prevResults.farmResults.find(
        (f) => f.farmId === farm.farmId
      );

      if (prevFarm && prevFarm.status !== farm.status) {
        openSnackbar({
          message:
            farm.status === FarmValidationStatus.VALID_MANUALLY
              ? `${t("common:polygon")} ${farm.farmId} ${t(
                  "polygonValidation:manualValidation.snackbarAlert.included"
                )}`
              : `${t("common:polygon")} ${farm.farmId} ${t(
                  "polygonValidation:manualValidation.snackbarAlert.excluded"
                )}`,
          type: "info",
        });
      }
    });

    // Update ref with current results
    prevValidationResultsRef.current = polygonsValidationResults;
  }, [polygonsValidationResults, openSnackbar, t]);

  return (
    <BasePolygonModal
      size="xl"
      title={
        <Text variant="h6" bold>
          {t("polygonValidation:overlapModal.title")}
        </Text>
      }
      hideCloseButton
      isOpen={isOpen}
      row={row}
      handleClose={handleModalClose}
      rowsGenerator={(row) =>
        generateRows(row, farmsData ?? [], selectedRows, openedRows, t)
      }
      mapObjectsGenerator={(row) => generateMapObjects(row, farmsData ?? [])}
      mapCenter={row?.data?.data.center || { lat: 0, lng: 0 }}
      tableTitle={
        <Text variant="body1" bold>
          {polygonsAmount} {t("polygonValidation:overlapModal.producers")} ·{" "}
          {t("polygonValidation:overlapModal.area")}: {area}
        </Text>
      }
      tableProps={{
        headers,
        selectable: true,
        selectAllCellComponent: (
          <Text variant="body2" bold>
            {t("polygonValidation:manualValidation.tableHeader")}
          </Text>
        ),
        selectAllCellStyle: {
          textAlign: "center",
          minWidth: "150px",
        },
        onRowSelected: (row, idx) => {
          if (!row.data) return;
          toggleSelectedRows([row.data.farmIds[idx]]);
        },
        onAllRowsSelected: () => {
          if (selectedRows.length === polygonsAmount) {
            toggleSelectedRows(selectedRows);
          } else {
            toggleSelectedRows(unselectedRows);
          }
        },
        isRowSelected: (row, idx) => {
          if (!row.data) return false;
          return selectedRows.includes(row.data.farmIds[idx]);
        },
        areAllSelected: selectedRows.length === polygonsAmount,
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
    >
      <Box
        sx={{
          marginTop: 3,
          display: "flex",
          justifyContent: "flex-end",
          gap: 2,
        }}
      >
        <Button variant="contained" onClick={handleModalClose}>
          {t("common:close")}
        </Button>
      </Box>
    </BasePolygonModal>
  );
};
