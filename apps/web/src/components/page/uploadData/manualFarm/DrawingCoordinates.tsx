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
} from "@mui/material";
import { FLOW_COLORS } from "@/components/page/flow/flowStyles";
import { FLOW_TABLE_FRAME, FLOW_TABLE_SX } from "@/components/page/flow/flowTable";
import { Coordinates } from "@/interfaces/Map";
import { Drawing, PolygonDrawing, RingRef, sameRing } from "@/utils/drawing";
import { VertexRef } from "./DrawingMap";
import { EYEBROW } from "./manualFarmStyles";

// Decimal places shown for a vertex (about 10 cm)
const SHOWN_COORDINATE_DECIMALS = 6;

// The stage pages' table, with compact rows: it lists many vertices in little room
const TABLE_SX = {
  ...FLOW_TABLE_SX,
  "& th": { ...FLOW_TABLE_SX["& th"], padding: "8px 14px" },
  "& td": {
    ...FLOW_TABLE_SX["& td"],
    padding: "7px 14px",
    fontSize: 13.5,
    fontVariantNumeric: "tabular-nums",
  },
  "& th[scope=rowgroup]": {
    padding: "6px 14px",
    fontSize: 12.5,
    letterSpacing: 0,
    textTransform: "none",
    color: FLOW_COLORS.ink2,
    backgroundColor: FLOW_COLORS.pageBackground,
  },
  "& tbody tr.Mui-selected, & tbody tr.Mui-selected:hover": {
    backgroundColor: FLOW_COLORS.blue50,
  },
  "& tbody tr.MuiTableRow-hover:hover": { backgroundColor: FLOW_COLORS.blue25 },
  // Only the table's last row goes without a line: a ring's last one keeps it
  "& tbody:not(:last-of-type) tr:last-of-type td": {
    borderBottom: `1px solid ${FLOW_COLORS.line}`,
  },
} as const;

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
      <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", columnGap: 1.5 }}>
        <Box component="h3" sx={EYEBROW}>
          {title}
        </Box>
        {selectable && (
          <Box component="span" sx={{ fontSize: 12.5, color: FLOW_COLORS.muted }}>
            {t("manualFarm:coordinates:selectHint")}
          </Box>
        )}
      </Box>
      <TableContainer sx={{ ...FLOW_TABLE_FRAME, maxHeight: 220, marginTop: 1 }}>
        <Table size="small" stickyHeader sx={TABLE_SX}>
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
                  <TableCell>{vertex.lat.toFixed(SHOWN_COORDINATE_DECIMALS)}</TableCell>
                  <TableCell>{vertex.lng.toFixed(SHOWN_COORDINATE_DECIMALS)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          ))}
        </Table>
      </TableContainer>
    </Box>
  );
};
