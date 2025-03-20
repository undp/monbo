"use client";

import React from "react";
import {
  Box,
  Breakpoint,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
} from "@mui/material";
import { Map, CircleObject, PolygonObject } from "@/components/reusable/Map";
import { Table, RowData, TableProps } from "@/components/reusable/Table";

import CloseIcon from "@mui/icons-material/Close";
import { Coordinates } from "@/interfaces/Map";

interface BasePolygonModalProps<T> {
  size?: Breakpoint;
  title: React.ReactNode;
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
  hideCloseButton?: boolean;
}

export function BasePolygonModal<T>({
  size = "lg",
  title,
  isOpen,
  handleClose,
  rowsGenerator,
  mapObjectsGenerator,
  row,
  mapCenter,
  tableProps,
  tableTitle,
  children,
  hideCloseButton = false,
}: BasePolygonModalProps<T>) {
  if (!row || !row.data) return null;

  const data = row.data;

  const rows = rowsGenerator(data);
  const mapObjects = mapObjectsGenerator(data);
  return (
    <Dialog open={isOpen} onClose={handleClose} fullWidth maxWidth={size}>
      <DialogTitle component="div">{title}</DialogTitle>
      {!hideCloseButton && (
        <IconButton
          aria-label="close"
          onClick={handleClose}
          sx={(theme) => ({
            position: "absolute",
            right: theme.spacing(1.5),
            top: theme.spacing(1.5),
            color: theme.palette.grey[500],
          })}
        >
          <CloseIcon />
        </IconButton>
      )}
      <DialogContent sx={{ paddingTop: 0 }}>
        <Box sx={{ display: "flex", gap: 2, height: 364 }}>
          <Box
            sx={{
              height: 364,
              flexGrow: 1,
              width: 463,
              maxWidth: 463,
            }}
          >
            <Map center={mapCenter} objects={mapObjects} autoZoom />
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
                border: "1px solid #DEDEDE",
                borderRadius: 2,
                padding: 1,
                gap: 1,
                maxHeight: "100%",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                {tableTitle}
              </Box>
              <Table
                headerStyle={{
                  backgroundColor: "#F9F9F9",
                  "& th:first-child": {
                    borderTopLeftRadius: 8,
                  },
                  "& th:last-child": {
                    borderTopRightRadius: 8,
                  },
                }}
                bodyStyle={{
                  "& tr:last-child td": {
                    borderBottom: "none",
                  },
                }}
                rows={rows}
                {...tableProps}
              />
            </Box>
          </Box>
        </Box>
        {children}
      </DialogContent>
    </Dialog>
  );
}
