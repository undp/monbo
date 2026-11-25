"use client";

import React from "react";
import { Box, Breakpoint, Dialog, DialogContent } from "@mui/material";
import { Map, CircleObject, PolygonObject } from "@/components/reusable/Map";
import { Table, RowData, TableProps } from "@/components/reusable/Table";
import { ModalHeader, ModalHeaderProps } from "@/components/reusable/Modals/ModalHeader";
import {
  MODAL_FOOTER,
  MODAL_PADDING,
  MODAL_PAPER,
} from "@/components/reusable/Modals/modalStyles";
import { FLOW_COLORS } from "@/components/page/flow/flowStyles";
import { FLOW_TABLE_COMPACT_SX } from "@/components/page/flow/flowTable";
import { Coordinates } from "@/interfaces/Map";

interface BasePolygonModalProps<T> {
  size?: Breakpoint;
  title: React.ReactNode;
  icon?: React.ReactNode;
  tone?: ModalHeaderProps["tone"];
  isOpen: boolean;
  handleClose: () => void;
  rowsGenerator: (data: T) => RowData<T>[];
  mapObjectsGenerator: (data: T) => (CircleObject | PolygonObject)[];
  row: RowData<T> | null;
  mapCenter: Coordinates;
  tableProps: Pick<
    TableProps<T>,
    | "selectable"
    | "selectAllCellComponent"
    | "selectAllCellStyle"
    | "headers"
    | "onRowSelected"
    | "isRowSelected"
    | "areAllSelected"
    | "onAllRowsSelected"
    | "actions"
  >;
  tableTitle: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  hideCloseButton?: boolean;
}

export function BasePolygonModal<T>({
  size = "lg",
  title,
  icon,
  tone,
  isOpen,
  handleClose,
  rowsGenerator,
  mapObjectsGenerator,
  row,
  mapCenter,
  tableProps,
  tableTitle,
  children,
  footer,
  hideCloseButton = false,
}: BasePolygonModalProps<T>) {
  if (!row || !row.data) return null;

  const data = row.data;

  const rows = rowsGenerator(data);
  const mapObjects = mapObjectsGenerator(data);
  return (
    <Dialog
      open={isOpen}
      onClose={handleClose}
      fullWidth
      maxWidth={size}
      slotProps={{ paper: { sx: MODAL_PAPER } }}
    >
      <ModalHeader
        title={title}
        icon={icon}
        tone={tone}
        onClose={hideCloseButton ? undefined : handleClose}
      />
      <DialogContent sx={{ padding: MODAL_PADDING }}>
        <Box sx={{ display: "flex", gap: 2, height: 364 }}>
          <Box
            sx={{
              height: 364,
              flexGrow: 1,
              width: 463,
              maxWidth: 463,
            }}
          >
            <Box sx={{ height: "100%", borderRadius: "12px", overflow: "hidden" }}>
              <Map center={mapCenter} objects={mapObjects} autoZoom />
            </Box>
          </Box>
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              flexGrow: 1,
            }}
          >
            <Box
              sx={{
                border: `1px solid ${FLOW_COLORS.line}`,
                borderRadius: "12px",
                overflow: "hidden",
                maxHeight: "100%",
                display: "flex",
                flexDirection: "column",
                // The stage pages' compact table, under the title's band
                ...FLOW_TABLE_COMPACT_SX,
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "10px 14px",
                  color: FLOW_COLORS.ink,
                  borderBottom: `1px solid ${FLOW_COLORS.line}`,
                }}
              >
                {tableTitle}
              </Box>
              <Table rows={rows} {...tableProps} />
            </Box>
            {children}
          </Box>
        </Box>
      </DialogContent>
      {/* The modal's actions, over a hairline, as BaseModal's */}
      {footer && <Box sx={MODAL_FOOTER}>{footer}</Box>}
    </Dialog>
  );
}
