"use client";

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
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

// The API's area for a point without one: the circle shows it until the field has a
// valid area
const DEFAULT_POINT_AREA_HECTARES = 1;

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

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      fullWidth
      maxWidth="lg"
      fullScreen={fullScreen}
      // Top-aligned: a centered Dialog would move the map as its content grows
      sx={{ "& .MuiDialog-container": { alignItems: "flex-start" } }}
      slotProps={{
        transition: {
          onEntered: () => setMapReady(true),
          onExited: () => setMapReady(false),
        },
      }}
    >
      <ManualFarmModalContent
        mapReady={mapReady}
        onCancel={onCancel}
        {...props}
      />
    </Dialog>
  );
};

const ManualFarmModalContent: React.FC<
  Omit<ManualFarmModalProps, "open"> & { mapReady: boolean }
> = ({ country, initialRow, onCancel, onSave, mapReady }) => {
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
      <DialogTitle component="div" sx={{ pr: 6 }}>
        <Typography variant="h6" component="h2">
          {editing ? t("manualFarm:editTitle") : t("manualFarm:addTitle")}
        </Typography>
      </DialogTitle>
      <IconButton
        aria-label={t("manualFarm:close")}
        onClick={onCancel}
        sx={(theme) => ({
          position: "absolute",
          right: theme.spacing(1.5),
          top: theme.spacing(1.5),
          color: theme.palette.grey[500],
        })}
      >
        <CloseIcon />
      </IconButton>
      <DialogContent sx={{ pt: 0 }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "minmax(0, 1fr)",
              md: "minmax(0, 1fr) 360px",
            },
            gap: 3,
          }}
        >
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: 1.5,
              minWidth: 0,
            }}
          >
            <DrawingToolbar farm={farm} onHowTo={() => setHowToOpen(true)} />
            <Box
              sx={{
                position: "relative",
                height: { xs: 300, md: 440 },
                borderRadius: 2,
                overflow: "hidden",
                backgroundColor: "grey.200",
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
            <Typography variant="body2" color="text.secondary">
              {t(`manualFarm:instructions:${farm.instructionsKey}`)}
            </Typography>
            {initial.notEditable && !drawing && (
              <Alert severity="info">
                {t(`manualFarm:notEditable:${initial.notEditable}`)}
              </Alert>
            )}
            {farm.error && (
              <Alert severity="warning" onClose={farm.clearError}>
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
          <ManualFarmFields form={form} showArea={farm.mode === "point"} />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, flexWrap: "wrap", gap: 1 }}>
        {!hasGeometry && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ mr: "auto" }}
          >
            {t(
              polygon?.open && polygon.parts.length
                ? `manualFarm:openRing:${polygon.open.kind}`
                : "manualFarm:missingGeometry"
            )}
          </Typography>
        )}
        <Button onClick={onCancel}>{t("manualFarm:actions:cancel")}</Button>
        <Button variant="contained" onClick={submit} disabled={!hasGeometry}>
          {editing ? t("manualFarm:actions:save") : t("manualFarm:actions:add")}
        </Button>
      </DialogActions>
      <HowToDraw open={howToOpen} onClose={() => setHowToOpen(false)} />
    </>
  );
};
