"use client";

import React, { useState } from "react";
import Image from "next/image";
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AddIcon from "@mui/icons-material/Add";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import AddLocationAltOutlinedIcon from "@mui/icons-material/AddLocationAltOutlined";
import { FarmRow } from "@/interfaces/FarmRow";
import { Coordinates } from "@/interfaces/Map";
import {
  addOpenVertex,
  areaToRadius,
  closeOpenRing,
  deleteRing,
  deleteRingVertex,
  discardOpenRing,
  Drawing,
  drawingBounds,
  DrawingEdit,
  DrawingProblem,
  drawingToGeometryFields,
  farmRowToDrawing,
  insertRingVertex,
  MIN_POLYGON_VERTICES,
  moveRingVertex,
  NotEditableReason,
  OpenRing,
  PolygonDrawing,
  RingRef,
  startDrawing,
  startRing,
} from "@/utils/drawing";
import { getCountryBounds } from "@/utils/countryBounds";
import { DrawingMap, DrawingMapProps, PathEdit, VertexRef } from "./DrawingMap";
import {
  emptyValues,
  FieldErrors,
  FieldName,
  MANDATORY_FIELDS,
  ManualFarmValues,
  MAX_DOCUMENTS,
  parseLocaleNumber,
  rowToValues,
  TextField as TextFieldName,
  validateManualFarm,
} from "./ManualFarmModalForm";

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

// The size of the "How to draw" GIFs (public/images/manual-farm-drawing-*.gif),
// recorded from this modal's map at its own size by scripts/record-drawing-gif.mjs
const HOW_TO_GIF = { width: 768, height: 542 };

/**
 * Adds a farm by drawing it on a satellite map (a polygon, with holes and several
 * parts, or a point with its area) and filling in the template's fields. The values live only while the modal is
 * open: its content mounts on open.
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
  const notEditable: NotEditableReason | null = initial.notEditable;

  const [values, setValues] = useState<ManualFarmValues>(initial.values);
  const [mode, setMode] = useState<Drawing["type"]>(
    initial.drawing?.type ?? "polygon"
  );
  const [drawing, setDrawing] = useState<Drawing | null>(initial.drawing);
  const [selectedVertex, setSelectedVertex] = useState<VertexRef | null>(null);
  const [drawingError, setDrawingError] = useState<DrawingProblem | null>(null);
  // "How to draw?" opens a larger animation on demand
  const [howToOpen, setHowToOpen] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [rowErrors, setRowErrors] = useState<string[]>([]);
  const [goTo, setGoTo] = useState({ lat: "", lng: "", invalid: false });
  const [focus, setFocus] = useState<DrawingMapProps["focus"]>(null);

  const area = parseLocaleNumber(values.area.trim(), language);
  const radius = areaToRadius(
    area && area > 0 ? area : DEFAULT_POINT_AREA_HECTARES
  );

  // Where the map opens: the farm being edited, else the selected country
  const [initialBounds] = useState(() =>
    initial.drawing
      ? drawingBounds(initial.drawing, radius)
      : getCountryBounds(country)
  );

  const polygon = drawing?.type === "polygon" ? drawing : null;
  const hasGeometry = !!drawing && !!drawingToGeometryFields(drawing);

  const updateDrawing = (next: Drawing | null) => {
    setDrawing(next);
    setDrawingError(null);
  };

  // An edit of the polygon: applied, or its problem shown. Whether it applied.
  const apply = (edit: DrawingEdit | { ok: true; drawing: null }) => {
    if (!edit.ok) {
      setDrawingError(edit.problem);
      return false;
    }
    setSelectedVertex(null);
    updateDrawing(edit.drawing);
    return true;
  };

  const startOver = () => {
    updateDrawing(null);
    setSelectedVertex(null);
  };

  const finish = () => {
    if (polygon?.open) apply(closeOpenRing(polygon));
  };

  const removeVertex = ({ ring, index }: VertexRef) => {
    if (polygon) apply(deleteRingVertex(polygon, ring, index));
  };

  const addRing = (kind: OpenRing["kind"]) => {
    if (!polygon) return;
    setSelectedVertex(null);
    updateDrawing(startRing(polygon, kind));
  };

  const discardRing = () => {
    if (polygon) updateDrawing(discardOpenRing(polygon));
  };

  const removeSelectedRing = () => {
    if (polygon && selectedVertex && selectedVertex.ring !== "open") {
      apply(deleteRing(polygon, selectedVertex.ring));
    }
  };

  // Whether the click placed the point or added a vertex
  const onMapClick = (position: Coordinates) => {
    if (mode === "point") {
      updateDrawing({ type: "point", center: position });
      return true;
    }
    if (!polygon) {
      updateDrawing(startDrawing(position));
      return true;
    }
    if (!polygon.open) {
      setSelectedVertex(null);
      return false;
    }
    return apply(addOpenVertex(polygon, position));
  };

  const onVertexClick = ({ ring, index }: VertexRef) => {
    if (!polygon) return;
    if (ring === "open") {
      if (index === 0) finish();
      return;
    }
    setSelectedVertex((current) =>
      current && sameRing(current.ring, ring) && current.index === index
        ? null
        : { ring, index }
    );
  };

  const onPathEdit = ({ ring, kind, index, position }: PathEdit) => {
    if (!polygon) return false;
    return apply(
      kind === "move"
        ? moveRingVertex(polygon, ring, index, position)
        : insertRingVertex(polygon, ring, index, position)
    );
  };

  const changeMode = (next: Drawing["type"] | null) => {
    if (!next || next === mode) return;
    setMode(next);
    startOver();
  };

  // The typed latitude and longitude, or null after marking them invalid
  const typedPosition = (): Coordinates | null => {
    const lat = parseCoordinate(goTo.lat);
    const lng = parseCoordinate(goTo.lng);
    if (
      lat === null ||
      lng === null ||
      Math.abs(lat) > 90 ||
      Math.abs(lng) > 180
    ) {
      setGoTo((current) => ({ ...current, invalid: true }));
      return null;
    }
    setGoTo((current) => ({ ...current, invalid: false }));
    return { lat, lng };
  };

  const onGo = () => {
    const center = typedPosition();
    if (center) setFocus({ center, key: Date.now() });
  };

  // A vertex, or the point, at known coordinates: added as a click there would be.
  // The fields empty for the next vertex, unless it was rejected.
  const onAddTyped = () => {
    const position = typedPosition();
    if (!position || !onMapClick(position)) return;
    // The first one zooms in on the farm; the next ones keep the user's zoom
    setFocus({ center: position, key: Date.now(), keepZoom: !!drawing });
    setGoTo({ lat: "", lng: "", invalid: false });
  };

  const setField = (field: TextFieldName, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => withoutError(current, field));
  };

  const setDocument = (index: number, key: "name" | "url", value: string) => {
    setValues((current) => ({
      ...current,
      documents: current.documents.map((document, i) =>
        i === index ? { ...document, [key]: value } : document
      ),
    }));
    setFieldErrors((current) => withoutError(current, `documentUrl.${index}`));
  };

  const removeDocument = (index: number) => {
    setValues((current) => ({
      ...current,
      documents: current.documents.filter((_, i) => i !== index),
    }));
    // The documents after it move up: their errors would point at the wrong one
    setFieldErrors((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([key]) => !key.startsWith("document"))
      )
    );
  };

  const onSubmit = () => {
    const result = validateManualFarm({ values, drawing, t, language });
    setFieldErrors(result.fieldErrors);
    setRowErrors(result.rowErrors);
    if (result.row) onSave(result.row);
  };

  const errorText = (field: FieldName) => {
    const error = fieldErrors[field];
    return error ? t(`manualFarm:fieldErrors:${error}`) : undefined;
  };

  const textField = (
    field: TextFieldName,
    extra?: Partial<React.ComponentProps<typeof TextField>>
  ) => (
    <TextField
      key={field}
      name={field}
      label={t(`manualFarm:fields:${field}`)}
      value={values[field]}
      onChange={(event) => setField(field, event.target.value)}
      required={(MANDATORY_FIELDS as readonly string[]).includes(field)}
      error={!!fieldErrors[field]}
      helperText={errorText(field)}
      size="small"
      fullWidth
      {...extra}
    />
  );

  const instructions =
    mode === "point"
      ? t("manualFarm:instructions:point")
      : !polygon || (polygon.open && !polygon.parts.length)
        ? t("manualFarm:instructions:polygon")
        : polygon.open
          ? t(`manualFarm:instructions:${polygon.open.kind === "hole" ? "newHole" : "newPart"}`)
          : t("manualFarm:instructions:polygonClosed");
  const selectedRing =
    selectedVertex && selectedVertex.ring !== "open" ? selectedVertex.ring : null;

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
            {/* Two rows from the start, so the map doesn't move as the actions change */}
            <Box
              sx={{
                display: "flex",
                gap: 1,
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <ToggleButtonGroup
                size="small"
                exclusive
                value={mode}
                onChange={(_, next) => changeMode(next)}
                aria-label={t("manualFarm:geometry:label")}
              >
                <ToggleButton value="polygon">
                  {t("manualFarm:geometry:polygon")}
                </ToggleButton>
                <ToggleButton value="point">
                  {t("manualFarm:geometry:point")}
                </ToggleButton>
              </ToggleButtonGroup>
              <Button
                size="small"
                startIcon={<InfoOutlinedIcon />}
                onClick={() => setHowToOpen(true)}
                sx={{ textTransform: "none" }}
              >
                {t("manualFarm:howTo:button")}
              </Button>
            </Box>
            <Box
              sx={{
                display: "flex",
                flexWrap: "wrap",
                gap: 1,
                alignItems: "center",
                minHeight: 31,
              }}
            >
              {polygon?.open && (
                <Button
                  size="small"
                  variant="contained"
                  onClick={finish}
                  disabled={polygon.open.vertices.length < MIN_POLYGON_VERTICES}
                >
                  {t("manualFarm:actions:finish")}
                </Button>
              )}
              {polygon?.open && polygon.parts.length > 0 && (
                <Button size="small" onClick={discardRing}>
                  {t(`manualFarm:actions:discard:${polygon.open.kind}`)}
                </Button>
              )}
              {polygon && !polygon.open && (
                <>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<AddIcon />}
                    onClick={() => addRing("part")}
                  >
                    {t("manualFarm:actions:addPart")}
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<AddIcon />}
                    onClick={() => addRing("hole")}
                  >
                    {t("manualFarm:actions:addHole")}
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => selectedVertex && removeVertex(selectedVertex)}
                    disabled={!selectedVertex}
                  >
                    {t("manualFarm:actions:deleteVertex")}
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={removeSelectedRing}
                    disabled={!selectedRing}
                  >
                    {t(
                      selectedRing?.hole !== null && selectedRing
                        ? "manualFarm:actions:deleteHole"
                        : "manualFarm:actions:deletePart"
                    )}
                  </Button>
                </>
              )}
              <Button size="small" onClick={startOver} disabled={!drawing}>
                {t("manualFarm:actions:startOver")}
              </Button>
            </Box>
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
                  mode={mode}
                  drawing={drawing}
                  radius={radius}
                  selectedVertex={selectedVertex}
                  initialBounds={initialBounds}
                  focus={focus}
                  onMapClick={onMapClick}
                  onVertexClick={onVertexClick}
                  onVertexRightClick={removeVertex}
                  onPathEdit={onPathEdit}
                  onPointMove={(center) =>
                    updateDrawing({ type: "point", center })
                  }
                />
              )}
            </Box>
            <Typography variant="body2" color="text.secondary">
              {instructions}
            </Typography>
            {notEditable && !drawing && (
              <Alert severity="info">
                {t(`manualFarm:notEditable:${notEditable}`)}
              </Alert>
            )}
            {drawingError && (
              <Alert severity="warning" onClose={() => setDrawingError(null)}>
                {t(`manualFarm:drawingErrors:${drawingError}`)}
              </Alert>
            )}
            <Box
              component="form"
              onSubmit={(event) => {
                event.preventDefault();
                onGo();
              }}
              sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}
            >
              <TextField
                label={t("manualFarm:goTo:latitude")}
                value={goTo.lat}
                onChange={(event) =>
                  setGoTo((current) => ({
                    ...current,
                    lat: event.target.value,
                  }))
                }
                error={goTo.invalid}
                size="small"
                slotProps={{ htmlInput: { inputMode: "decimal" } }}
                sx={{ flex: 1 }}
              />
              <TextField
                label={t("manualFarm:goTo:longitude")}
                value={goTo.lng}
                onChange={(event) =>
                  setGoTo((current) => ({
                    ...current,
                    lng: event.target.value,
                  }))
                }
                error={goTo.invalid}
                size="small"
                slotProps={{ htmlInput: { inputMode: "decimal" } }}
                sx={{ flex: 1 }}
              />
              <Button type="submit" variant="outlined" sx={{ height: 40 }}>
                {t("manualFarm:actions:go")}
              </Button>
              <Button
                variant="outlined"
                startIcon={<AddLocationAltOutlinedIcon />}
                onClick={onAddTyped}
                disabled={!!polygon && !polygon.open}
                sx={{ height: 40, whiteSpace: "nowrap", flexShrink: 0 }}
              >
                {t("manualFarm:actions:addPoint")}
              </Button>
            </Box>
            {goTo.invalid && (
              <Typography variant="caption" color="error">
                {t("manualFarm:goTo:invalid")}
              </Typography>
            )}
            {drawing && (
              <DrawingCoordinates
                drawing={drawing}
                selectedVertex={selectedVertex}
                onSelectVertex={onVertexClick}
              />
            )}
          </Box>

          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: 2,
              minWidth: 0,
            }}
          >
            <Typography variant="subtitle2">
              {t("manualFarm:fields:mandatoryTitle")}
            </Typography>
            {textField("producerName")}
            {textField("productionDate", {
              type: "date",
              slotProps: { inputLabel: { shrink: true } },
            })}
            {textField("productionQuantity", {
              slotProps: { htmlInput: { inputMode: "decimal" } },
            })}
            {textField("productionQuantityUnit")}
            {textField("cropType")}
            {mode === "point" &&
              textField("area", {
                required: true,
                slotProps: { htmlInput: { inputMode: "decimal" } },
              })}

            <Typography variant="subtitle2">
              {t("manualFarm:fields:optionalTitle")}
            </Typography>
            {textField("id")}
            {textField("region")}
            {textField("association")}
            {values.documents.map((document, index) => (
              <Box
                key={index}
                sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}
              >
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 1,
                    flex: 1,
                  }}
                >
                  <TextField
                    label={t("manualFarm:fields:documentName", {
                      number: index + 1,
                    })}
                    value={document.name}
                    onChange={(event) =>
                      setDocument(index, "name", event.target.value)
                    }
                    size="small"
                    fullWidth
                  />
                  <TextField
                    label={t("manualFarm:fields:documentUrl", {
                      number: index + 1,
                    })}
                    value={document.url}
                    onChange={(event) =>
                      setDocument(index, "url", event.target.value)
                    }
                    error={!!fieldErrors[`documentUrl.${index}`]}
                    helperText={errorText(`documentUrl.${index}`)}
                    size="small"
                    fullWidth
                    slotProps={{ htmlInput: { inputMode: "url" } }}
                  />
                </Box>
                <IconButton
                  aria-label={t("manualFarm:actions:removeDocument")}
                  onClick={() => removeDocument(index)}
                >
                  <DeleteOutlineIcon />
                </IconButton>
              </Box>
            ))}
            {values.documents.length < MAX_DOCUMENTS && (
              <Button
                startIcon={<AddIcon />}
                onClick={() =>
                  setValues((current) => ({
                    ...current,
                    documents: [...current.documents, { name: "", url: "" }],
                  }))
                }
                sx={{ alignSelf: "flex-start" }}
              >
                {t("manualFarm:actions:addDocument")}
              </Button>
            )}
            {rowErrors.length > 0 && (
              <Alert severity="error">
                {rowErrors.map((message) => (
                  <div key={message}>{message}</div>
                ))}
              </Alert>
            )}
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, flexWrap: "wrap", gap: 1 }}>
        {!hasGeometry && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ mr: "auto" }}
          >
            {t("manualFarm:missingGeometry")}
          </Typography>
        )}
        <Button onClick={onCancel}>{t("manualFarm:actions:cancel")}</Button>
        <Button variant="contained" onClick={onSubmit} disabled={!hasGeometry}>
          {editing ? t("manualFarm:actions:save") : t("manualFarm:actions:add")}
        </Button>
      </DialogActions>
      <HowToDraw open={howToOpen} onClose={() => setHowToOpen(false)} />
    </>
  );
};

/** A larger animation of drawing a polygon, with its steps, opened from the
 * drawing toolbar's "How to draw?" button. */
const HowToDraw: React.FC<{ open: boolean; onClose: () => void }> = ({
  open,
  onClose,
}) => {
  const { t, i18n } = useTranslation();
  const language = i18n.language === "en" ? "en" : "es";
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ paddingRight: 6 }}>
        {t("manualFarm:howTo:title")}
        <IconButton
          aria-label={t("manualFarm:close")}
          onClick={onClose}
          sx={{ position: "absolute", top: 8, right: 8 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Image
          src={`/images/manual-farm-drawing-${language}.gif`}
          alt={t("manualFarm:howTo:alt")}
          width={HOW_TO_GIF.width}
          height={HOW_TO_GIF.height}
          // Served as is: Next's optimizer doesn't resize animated images
          unoptimized
          style={{
            display: "block",
            width: "100%",
            height: "auto",
            borderRadius: 8,
          }}
        />
        <Box component="ol" sx={{ marginBottom: 0, paddingLeft: 2.5 }}>
          {(["1", "2", "3", "4", "5", "6"] as const).map((step) => (
            <Typography component="li" variant="body2" key={step}>
              {t(`manualFarm:howTo:steps:${step}`)}
            </Typography>
          ))}
        </Box>
      </DialogContent>
    </Dialog>
  );
};

// Decimal places shown for a vertex (about 10 cm)
const SHOWN_COORDINATE_DECIMALS = 6;

interface CoordinateGroup {
  title: string;
  ring: RingRef;
  vertices: Coordinates[];
}

// The polygon's rings, as the table lists them: each part's exterior and holes,
// then the ring being drawn
const coordinateGroups = (
  drawing: PolygonDrawing,
  t: ReturnType<typeof useTranslation>["t"]
): CoordinateGroup[] => [
  ...drawing.parts.flatMap(({ exterior, holes }, part) => [
    {
      title: t("manualFarm:coordinates:part", { number: part + 1 }),
      ring: { part, hole: null },
      vertices: exterior,
    },
    ...holes.map((vertices, hole) => ({
      title: t("manualFarm:coordinates:hole", {
        part: part + 1,
        number: hole + 1,
      }),
      ring: { part, hole },
      vertices,
    })),
  ]),
  ...(drawing.open?.vertices.length
    ? [
        {
          title:
            drawing.open.kind === "part"
              ? t("manualFarm:coordinates:part", {
                  number: drawing.parts.length + 1,
                })
              : t("manualFarm:coordinates:newHole"),
          ring: "open" as const,
          vertices: drawing.open.vertices,
        },
      ]
    : []),
];

/** The latitude and longitude of the farm's vertices, grouped by ring, or of the
 * point, as they are drawn. With no ring being drawn, a row selects its vertex on
 * the map. */
const DrawingCoordinates: React.FC<{
  drawing: Drawing;
  selectedVertex: VertexRef | null;
  onSelectVertex: (vertex: VertexRef) => void;
}> = ({ drawing, selectedVertex, onSelectVertex }) => {
  const { t } = useTranslation();
  const groups =
    drawing.type === "polygon"
      ? coordinateGroups(drawing, t)
      : [{ title: "", ring: "open" as const, vertices: [drawing.center] }];
  const selectable = drawing.type === "polygon" && !drawing.open;
  const count = groups.reduce((sum, group) => sum + group.vertices.length, 0);
  const title =
    drawing.type === "polygon"
      ? t("manualFarm:coordinates:polygonTitle", { count })
      : t("manualFarm:coordinates:pointTitle");
  const isSelected = (ring: RingRef, index: number) =>
    !!selectedVertex &&
    sameRing(selectedVertex.ring, ring) &&
    selectedVertex.index === index;
  const numberCell = { width: 56 };

  return (
    <Box component="section" aria-label={title}>
      <Typography variant="subtitle2">{title}</Typography>
      {selectable && (
        <Typography variant="caption" color="text.secondary">
          {t("manualFarm:coordinates:selectHint")}
        </Typography>
      )}
      <TableContainer
        sx={{
          maxHeight: 200,
          marginTop: 0.5,
          border: 1,
          borderColor: "divider",
          borderRadius: 1,
        }}
      >
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              {drawing.type === "polygon" && (
                <TableCell sx={numberCell}>
                  {t("manualFarm:coordinates:number")}
                </TableCell>
              )}
              <TableCell>{t("manualFarm:goTo:latitude")}</TableCell>
              <TableCell>{t("manualFarm:goTo:longitude")}</TableCell>
            </TableRow>
          </TableHead>
          {groups.map(({ title: groupTitle, ring, vertices }) => (
            <TableBody key={groupTitle || "point"}>
              {drawing.type === "polygon" && (
                <TableRow>
                  <TableCell
                    component="th"
                    scope="rowgroup"
                    colSpan={3}
                    sx={{ fontWeight: 600, backgroundColor: "grey.50" }}
                  >
                    {groupTitle}
                  </TableCell>
                </TableRow>
              )}
              {vertices.map((vertex, index) => (
                <TableRow
                  key={index}
                  hover={selectable}
                  selected={selectable && isSelected(ring, index)}
                  onClick={
                    selectable ? () => onSelectVertex({ ring, index }) : undefined
                  }
                  sx={selectable ? { cursor: "pointer" } : undefined}
                >
                  {drawing.type === "polygon" && (
                    <TableCell>{index + 1}</TableCell>
                  )}
                  <TableCell sx={{ fontVariantNumeric: "tabular-nums" }}>
                    {vertex.lat.toFixed(SHOWN_COORDINATE_DECIMALS)}
                  </TableCell>
                  <TableCell sx={{ fontVariantNumeric: "tabular-nums" }}>
                    {vertex.lng.toFixed(SHOWN_COORDINATE_DECIMALS)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          ))}
        </Table>
      </TableContainer>
    </Box>
  );
};

const sameRing = (a: RingRef, b: RingRef) =>
  a === "open" || b === "open"
    ? a === b
    : a.part === b.part && a.hole === b.hole;

const withoutError = (errors: FieldErrors, field: FieldName): FieldErrors =>
  Object.fromEntries(
    Object.entries(errors).filter(([key]) => key !== field)
  ) as FieldErrors;

// A coordinate typed with a dot or a comma as the decimal separator
const parseCoordinate = (value: string): number | null => {
  const text = value.trim().replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(text)) return null;
  return Number(text);
};
