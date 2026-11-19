"use client";

import React, { useContext } from "react";
import { Box, Button, Checkbox, FormControlLabel } from "@mui/material";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import { useTranslation } from "react-i18next";
import { CircleObject, PolygonObject } from "@/components/reusable/Map";
import { Header, RowData } from "@/components/reusable/Table";
import { Text } from "@/components/reusable/Text";
import { FLOW_COLORS } from "@/components/page/flow/flowStyles";
import { issueMapColor, multipleObjectsMapColors } from "@/config/theme";
import { DataContext } from "@/context/DataContext";
import { SnackbarContext } from "@/context/SnackbarContext";
import { FarmData } from "@/interfaces/Farm";
import { FarmValidationStatus } from "@/interfaces/PolygonValidation";
import { formatOverlapPercentage } from "@/utils/numbers";
import { formatArea } from "@/utils/polygons";
import { FarmValidationView, withFarmStatus } from "@/utils/validationResults";
import { BasePolygonModal } from "./BasePolygonModal";

const colorAt = (index: number) =>
  multipleObjectsMapColors[index % multipleObjectsMapColors.length];

// The stage pages' tones, as the status chips of the results table
const CRITICALITY_COLORS = {
  HIGH: { color: FLOW_COLORS.bad, backgroundColor: FLOW_COLORS.badBackground },
  MEDIUM: { color: FLOW_COLORS.warn, backgroundColor: FLOW_COLORS.warnBackground },
} as const;

const farmObject = (
  farm: FarmData,
  color: string
): CircleObject | PolygonObject =>
  farm.polygon.type === "point"
    ? {
        id: farm.id,
        type: "circle",
        center: farm.polygon.details.center,
        radius: farm.polygon.details.radius,
        color,
        showPoints: true,
      }
    : {
        id: farm.id,
        type: "polygon",
        parts: farm.polygon.details?.parts ?? [],
        color,
        showPoints: true,
      };

const farmCenter = (farm: FarmData) =>
  (farm.polygon.type === "point"
    ? farm.polygon.details.center
    : farm.polygon.details?.center) ?? { lat: 0, lng: 0 };

interface Props {
  /** The farm under review, with its overlaps; null when closed. */
  view: FarmValidationView | null;
  onClose: () => void;
}

/**
 * Every overlap of one farm: the map with the farm, its neighbours and each
 * overlapping area, one line per neighbour, and the control that validates this
 * farm manually. Only this farm: each neighbour is validated from its own row.
 */
export const FarmOverlapsModal: React.FC<Props> = ({ view, onClose }) => {
  const { t, i18n } = useTranslation();
  const { farmsData, setPolygonsValidationResults } = useContext(DataContext);
  const { openSnackbar } = useContext(SnackbarContext);
  if (!view) return null;

  const { farm, overlaps } = view;
  const validated = view.status === FarmValidationStatus.VALID_MANUALLY;
  const neighbour = (id: string) => farmsData?.find((item) => item.id === id);

  const toggle = () => {
    const status = validated
      ? FarmValidationStatus.NOT_VALID
      : FarmValidationStatus.VALID_MANUALLY;
    setPolygonsValidationResults((prev) =>
      prev ? withFarmStatus(prev, farm.id, status) : prev
    );
    openSnackbar({
      message: `${t("common:polygon")} ${farm.id} ${t(
        validated
          ? "polygonValidation:manualValidation:snackbarAlert:excluded"
          : "polygonValidation:manualValidation:snackbarAlert:included"
      )}`,
      type: "info",
    });
  };

  const headers: Header[] = [
    { name: t("polygonValidation:farmOverlapsModal:headers:id"), attr: "id", type: "label" },
    { name: t("polygonValidation:farmOverlapsModal:headers:producer"), attr: "producer", type: "label" },
    { name: t("polygonValidation:farmOverlapsModal:headers:area"), attr: "area", type: "label" },
    { name: t("polygonValidation:farmOverlapsModal:headers:percentage"), attr: "percentage", type: "label" },
    { name: t("polygonValidation:farmOverlapsModal:headers:criticality"), attr: "criticality", type: "chip" },
  ];

  const rowsGenerator = (): RowData<FarmValidationView>[] =>
    overlaps.map(({ neighbourId, data }, index) => ({
      data: view,
      cells: {
        id: {
          value: (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <FiberManualRecordIcon
                aria-hidden
                sx={{ width: 15, height: 15, color: colorAt(index + 1) }}
              />
              {neighbourId}
            </Box>
          ),
        },
        producer: { value: neighbour(neighbourId)?.producer ?? "" },
        area: {
          value: formatArea(data.area, i18n.language),
          cellStyle: { whiteSpace: "nowrap" },
        },
        percentage: {
          value: formatOverlapPercentage(data.percentage, i18n.language),
        },
        criticality: {
          value: t(`polygonValidation:farmOverlapsModal:criticality:${data.criticality}`),
          chipStyle: { ...CRITICALITY_COLORS[data.criticality], fontWeight: 700 },
        },
      },
    }));

  const mapObjectsGenerator = () => [
    farmObject(farm, colorAt(0)),
    ...overlaps.flatMap(({ neighbourId }, index) => {
      const other = neighbour(neighbourId);
      return other ? [farmObject(other, colorAt(index + 1))] : [];
    }),
    ...overlaps.map(
      ({ neighbourId, data }): PolygonObject => ({
        id: `overlap-${neighbourId}`,
        type: "polygon",
        parts: data.parts,
        color: issueMapColor,
        fill: true,
      })
    ),
  ];

  return (
    <BasePolygonModal
      size="xl"
      title={
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <FiberManualRecordIcon
            aria-hidden
            sx={{ width: 15, height: 15, color: colorAt(0) }}
          />
          <Text variant="h6" bold>
            {t("polygonValidation:farmOverlapsModal:title", {
              id: farm.id,
              interpolation: { escapeValue: false },
            })}
          </Text>
        </Box>
      }
      hideCloseButton
      isOpen
      row={{ cells: {}, data: view }}
      handleClose={onClose}
      rowsGenerator={rowsGenerator}
      mapObjectsGenerator={mapObjectsGenerator}
      mapCenter={farmCenter(farm)}
      tableTitle={
        <Text variant="body1" bold>
          {t("polygonValidation:farmOverlapsModal:summary", {
            count: overlaps.length,
          })}
        </Text>
      }
      tableProps={{ headers }}
    >
      <Box
        sx={{
          marginTop: 2,
          padding: 1.5,
          borderRadius: 2,
          border: "1px solid #DEDEDE",
        }}
      >
        <FormControlLabel
          control={<Checkbox checked={validated} onChange={toggle} />}
          label={
            <Text variant="body1" bold>
              {t("polygonValidation:farmOverlapsModal:validate", {
                id: farm.id,
                interpolation: { escapeValue: false },
              })}
            </Text>
          }
        />
        <Text variant="body2" color="secondary">
          {t("polygonValidation:farmOverlapsModal:validateHint")}
        </Text>
      </Box>
      <Box sx={{ marginTop: 2, display: "flex", justifyContent: "flex-end" }}>
        <Button variant="contained" onClick={onClose}>
          {t("common:close")}
        </Button>
      </Box>
    </BasePolygonModal>
  );
};
