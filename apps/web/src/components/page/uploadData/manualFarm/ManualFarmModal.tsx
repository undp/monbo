"use client";

import React, { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import AddLocationAltOutlinedIcon from "@mui/icons-material/AddLocationAltOutlined";
import EditLocationAltOutlinedIcon from "@mui/icons-material/EditLocationAltOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import TipsAndUpdatesOutlinedIcon from "@mui/icons-material/TipsAndUpdatesOutlined";
import { FLOW_COLORS } from "@/components/page/flow/flowStyles";
import { FarmRow } from "@/interfaces/FarmRow";
import {
  areaToRadius,
  drawingBounds,
  drawingToGeometryFields,
  farmRowToDrawing,
} from "@/utils/drawing";
import { getCountryBounds } from "@/utils/countryBounds";
import { CoordinatesInput } from "./CoordinatesInput";
import { DrawingCoordinates } from "./DrawingCoordinates";
import { DrawingMap, DrawingMapProps } from "./DrawingMap";
import { DrawingToolbar } from "./DrawingToolbar";
import { HowToDraw } from "./HowToDraw";
import { ManualFarmFields } from "./ManualFarmFields";
import { ModalHeader } from "@/components/reusable/Modals/ModalHeader";
import { MODAL_PAPER } from "@/components/reusable/Modals/modalStyles";
import { PRIMARY_BUTTON, TEXT_BUTTON } from "./manualFarmStyles";
import { emptyValues, parseLocaleNumber, rowToValues } from "./ManualFarmModalForm";
import { useFarmDrawing } from "./useFarmDrawing";
import { useManualFarmForm } from "./useManualFarmForm";

interface ManualFarmModalProps {
  open: boolean;
  // The selected country (ISO alpha-2): the map opens on it
  country: string | null;
  // Edit mode when given
  initialRow?: FarmRow | null;
  onCancel: () => void;
  // A validated row
  onSave: (row: FarmRow) => void;
}

// The API's default for a point without an area (FarmDefaults.DEFAULT_POINT_AREA_HECTARES):
// the circle shows it until the field has a valid area
const DEFAULT_POINT_AREA_HECTARES = 4;

/**
 * Adds a farm by drawing it on a satellite map (a polygon, with holes and several
 * parts, or a point with its area) and filling in the template's fields. The
 * values live only while the modal is open: its content mounts on open.
 */
export const ManualFarmModal: React.FC<ManualFarmModalProps> = ({
  open,
  onCancel,
  ...props
}) => {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));
  // Google Maps measures its container when it mounts: only after the Dialog opened
  const [mapReady, setMapReady] = useState(false);
  const subtitleId = useId();

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      aria-describedby={subtitleId}
      fullWidth
      maxWidth="lg"
      fullScreen={fullScreen}
      // Top-aligned: a centered Dialog would move the map as its content grows
      sx={{ "& .MuiDialog-container": { alignItems: "flex-start" } }}
      slotProps={{
        paper: { sx: fullScreen ? undefined : MODAL_PAPER },
        transition: {
          onEntered: () => setMapReady(true),
          onExited: () => setMapReady(false),
        },
      }}
    >
      <ManualFarmModalContent
        mapReady={mapReady}
        subtitleId={subtitleId}
        onCancel={onCancel}
        {...props}
      />
    </Dialog>
  );
};

const ManualFarmModalContent: React.FC<
  Omit<ManualFarmModalProps, "open"> & { mapReady: boolean; subtitleId: string }
> = ({ country, initialRow, onCancel, onSave, mapReady, subtitleId }) => {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const editing = !!initialRow;

  // The listed farm, read once when the modal opens
  const [initial] = useState(() => {
    const rowDrawing = initialRow ? farmRowToDrawing(initialRow) : null;
    return {
      values: initialRow ? rowToValues(initialRow, language) : emptyValues(),
      drawing: rowDrawing?.editable ? rowDrawing.drawing : null,
      notEditable:
        rowDrawing && !rowDrawing.editable ? rowDrawing.reason : null,
    };
  });
  const farm = useFarmDrawing(initial.drawing);
  const form = useManualFarmForm(initial.values);
  // "How to draw?" opens a larger animation on demand
  const [howToOpen, setHowToOpen] = useState(false);
  const [focus, setFocus] = useState<DrawingMapProps["focus"]>(null);
  const { drawing, polygon } = farm;

  const area = parseLocaleNumber(form.values.area.trim(), language);
  const radius = areaToRadius(
    area && area > 0 ? area : DEFAULT_POINT_AREA_HECTARES
  );
  // Where the map opens: the farm being edited, else the selected country
  const [initialBounds] = useState(() =>
    initial.drawing
      ? drawingBounds(initial.drawing, radius)
      : getCountryBounds(country)
  );
  const hasGeometry = !!drawing && !!drawingToGeometryFields(drawing);

  const submit = () => {
    const row = form.validate(drawing);
    if (row) onSave(row);
  };

  return (
    <>
      <ModalHeader
        title={editing ? t("manualFarm:editTitle") : t("manualFarm:addTitle")}
        subtitle={t(editing ? "manualFarm:editSubtitle" : "manualFarm:addSubtitle")}
        subtitleId={subtitleId}
        icon={editing ? <EditLocationAltOutlinedIcon /> : <AddLocationAltOutlinedIcon />}
        onClose={onCancel}
      />
      <DialogContent sx={{ padding: 0 }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "minmax(0, 1fr)",
              // The map keeps the 768 px the "How to draw" GIFs were recorded at
              md: "minmax(0, 1fr) 384px",
            },
          }}
        >
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: 1.5,
              minWidth: 0,
              padding: { xs: 2, md: "20px 24px 24px" },
            }}
          >
            <DrawingToolbar farm={farm} onHowTo={() => setHowToOpen(true)} />
            <Box
              sx={{
                position: "relative",
                height: { xs: 300, md: 440 },
                borderRadius: "12px",
                border: `1px solid ${FLOW_COLORS.line}`,
                overflow: "hidden",
                backgroundColor: FLOW_COLORS.blue50,
              }}
            >
              {mapReady && (
                <DrawingMap
                  mode={farm.mode}
                  drawing={drawing}
                  radius={radius}
                  selectedVertex={farm.selectedVertex}
                  initialBounds={initialBounds}
                  focus={focus}
                  onMapClick={farm.onMapClick}
                  onVertexClick={farm.onVertexClick}
                  onVertexRightClick={farm.removeVertex}
                  onPathEdit={farm.onPathEdit}
                  onPointMove={farm.movePoint}
                />
              )}
            </Box>
            <Box
              sx={{
                display: "flex",
                alignItems: "flex-start",
                gap: 1.25,
                padding: "10px 14px",
                borderRadius: "10px",
                backgroundColor: FLOW_COLORS.blue25,
                border: `1px solid ${FLOW_COLORS.line}`,
                fontSize: 13.5,
                lineHeight: 1.5,
                color: FLOW_COLORS.ink2,
              }}
            >
              <TipsAndUpdatesOutlinedIcon
                aria-hidden
                sx={{ fontSize: 18, marginTop: "1px", color: FLOW_COLORS.leafDark }}
              />
              {t(`manualFarm:instructions:${farm.instructionsKey}`)}
            </Box>
            {initial.notEditable && !drawing && (
              <Alert severity="info" sx={{ borderRadius: "10px" }}>
                {t(`manualFarm:notEditable:${initial.notEditable}`)}
              </Alert>
            )}
            {farm.error && (
              <Alert
                severity="warning"
                onClose={farm.clearError}
                closeText={t("manualFarm:close")}
                sx={{ borderRadius: "10px" }}
              >
                {t(`manualFarm:drawingErrors:${farm.error}`)}
              </Alert>
            )}
            <CoordinatesInput
              onGo={(center) => setFocus({ center, key: Date.now() })}
              onAdd={(position) => {
                if (!farm.onMapClick(position)) return false;
                // The first one zooms in on the farm; the next ones keep the zoom
                setFocus({ center: position, key: Date.now(), keepZoom: !!drawing });
                return true;
              }}
              addDisabled={!!polygon && !polygon.open}
            />
            {drawing && (
              <DrawingCoordinates
                drawing={drawing}
                selectedVertex={farm.selectedVertex}
                onSelectVertex={farm.onVertexClick}
              />
            )}
          </Box>
          {/* The farm's data, in a side panel that runs the content's height */}
          <Box
            sx={{
              minWidth: 0,
              padding: { xs: 2, md: "20px 24px 24px" },
              backgroundColor: FLOW_COLORS.blue25,
              // A line that takes no width, as a border would from the map
              boxShadow: {
                xs: `inset 0 1px 0 ${FLOW_COLORS.line}`,
                md: `inset 1px 0 0 ${FLOW_COLORS.line}`,
              },
            }}
          >
            <ManualFarmFields form={form} showArea={farm.mode === "point"} />
          </Box>
        </Box>
      </DialogContent>
      <DialogActions
        disableSpacing
        sx={{
          flexWrap: "wrap",
          gap: 1,
          padding: { xs: "12px 16px", md: "14px 24px" },
          borderTop: `1px solid ${FLOW_COLORS.line}`,
        }}
      >
        {!hasGeometry && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.75,
              marginRight: "auto",
              fontSize: 13,
              color: FLOW_COLORS.muted,
            }}
          >
            <InfoOutlinedIcon aria-hidden sx={{ fontSize: 16 }} />
            {t(
              polygon?.open && polygon.parts.length
                ? `manualFarm:openRing:${polygon.open.kind}`
                : "manualFarm:missingGeometry"
            )}
          </Box>
        )}
        <Button onClick={onCancel} sx={{ ...TEXT_BUTTON, padding: "8px 16px" }}>
          {t("manualFarm:actions:cancel")}
        </Button>
        <Button
          variant="contained"
          onClick={submit}
          disabled={!hasGeometry}
          sx={{ ...PRIMARY_BUTTON, padding: "8px 22px" }}
        >
          {editing ? t("manualFarm:actions:save") : t("manualFarm:actions:add")}
        </Button>
      </DialogActions>
      <HowToDraw open={howToOpen} onClose={() => setHowToOpen(false)} />
    </>
  );
};
