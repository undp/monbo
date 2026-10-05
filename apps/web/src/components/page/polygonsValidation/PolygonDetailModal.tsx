"use client";

import React, { useContext, useMemo } from "react";
import { CircleObject, PolygonObject } from "@/components/reusable/Map";
import { RowData } from "@/components/reusable/Table";
import { BasePolygonModal } from "./BasePolygonModal";
import { Text } from "@/components/reusable/Text";
import { FarmData } from "@/interfaces/Farm";
import { baseMapColor } from "@/config/theme";
import {
  parsePolygonArea,
  parseLatitude,
  parseLongitude,
} from "@/utils/polygons";
import { useTranslation } from "react-i18next";
import { PolygonTypeIcon } from "@/components/reusable/PolygonTypeIcon";
import { Box } from "@mui/material";
import { DataContext } from "@/context/DataContext";
import { FarmValidationStatus } from "@/interfaces/PolygonValidation";
import { ValidManuallyChip } from "./ValidManuallyChip";

const generateRows = (farm: FarmData) => {
  if (farm.polygon.type === "point") {
    return [
      {
        cells: {
          point: { value: "1" },
          latitude: { value: parseLatitude(farm.polygon.details.center.lat) },
          longitude: { value: parseLongitude(farm.polygon.details.center.lng) },
        },
      },
    ];
  }
  return (
    farm.polygon.details?.path?.map((point, idx) => ({
      cells: {
        point: { value: idx + 1 },
        latitude: { value: parseLatitude(point.lat) },
        longitude: { value: parseLongitude(point.lng) },
      },
    })) ?? []
  );
};

const generateMapObjects = (
  farm: FarmData
): (CircleObject | PolygonObject)[] => {
  if (farm.polygon.type === "point") {
    return [
      {
        id: farm.id,
        type: "circle",
        center: farm.polygon.details.center,
        radius: farm.polygon.details.radius,
        color: baseMapColor,
        showPoints: true,
      },
    ];
  }
  return [
    {
      id: farm.id,
      type: "polygon",
      path: farm.polygon.details?.path ?? [],
      color: baseMapColor,
      showPoints: true,
    },
  ];
};

interface PolygonDetailModalProps {
  isOpen: boolean;
  handleClose: () => void;
  row: RowData<FarmData> | null;
}

export const PolygonDetailModal: React.FC<PolygonDetailModalProps> = ({
  isOpen,
  handleClose,
  row,
}) => {
  const { polygonsValidationResults } = useContext(DataContext);
  const { t, i18n } = useTranslation();

  const data = row?.data;
  const area = parsePolygonArea(data?.polygon.area || 0, i18n.language);

  const isManuallyValidated = useMemo(
    () =>
      polygonsValidationResults?.farmResults.find(
        (fr) => fr.farmId === data?.id
      )?.status === FarmValidationStatus.VALID_MANUALLY,
    [polygonsValidationResults, data?.id]
  );

  if (!data) return null;

  return (
    <BasePolygonModal
      isOpen={isOpen}
      row={row}
      handleClose={handleClose}
      rowsGenerator={generateRows}
      mapObjectsGenerator={generateMapObjects}
      title={
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <PolygonTypeIcon
            sx={{
              gap: 1,
            }}
            polygonType={data.polygon.type}
          />
          <Text variant="h6" bold>
            {data.polygon.type === "point"
              ? t("common:point")
              : t("common:polygon")}{" "}
            · ID {data.id}
          </Text>
        </Box>
      }
      mapCenter={data.polygon.details?.center ?? { lat: 0, lng: 0 }}
      tableTitle={
        <Box
          sx={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text variant="body1" bold>{`${data.producer} · ${area}`}</Text>
          {isManuallyValidated && <ValidManuallyChip />}
        </Box>
      }
      tableProps={{
        headers: [
          { name: t("common:point"), attr: "point", type: "label" },
          { name: t("common:latitude"), attr: "latitude", type: "label" },
          { name: t("common:longitude"), attr: "longitude", type: "label" },
        ],
      }}
    />
  );
};
