"use client";

import React from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { Coordinates } from "@/interfaces/Map";
import { Drawing, PolygonDrawing, RingRef, sameRing } from "@/utils/drawing";
import { VertexRef } from "./DrawingMap";

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
export const DrawingCoordinates: React.FC<{
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
