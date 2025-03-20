"use client";
import { formatNumber } from "@/utils/numbers";
import {
  TableContainer,
  Table as MUITable,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableFooter,
  Chip,
  SxProps,
  Checkbox,
  TableSortLabel,
  Theme,
  Box,
} from "@mui/material";
import React from "react";

export interface Header {
  name: React.ReactNode;
  attr: string;
  type: "label" | "chip" | "icon";
  sortable?: boolean;
  columnStyle?: SxProps<Theme>;
  chip?: ChipCellProps;
}

type Footer = Record<string, React.ReactNode>;

export interface RowData<T> {
  haveActions?: boolean;
  cells: Record<string, CellData>;
  data?: T;
  isOpen?: boolean;
  rowStyle?: SxProps<Theme>;
  foldedRows?: RowData<T>[];
}

export interface CellData {
  value?: React.ReactNode;
  icon?: React.ReactNode;
  rowSpan?: number;
  cellStyle?: SxProps<Theme>;
  chipStyle?: SxProps<Theme>;
}

interface ChipCellProps {
  label: React.ReactNode;
  sx?: SxProps<Theme>;
}
const ChipCell: React.FC<ChipCellProps> = ({ label, sx }) => {
  return (
    <Chip
      label={label}
      sx={{
        fontWeight: 500,
        textTransform: "uppercase",
        fontSize: 12,
        minWidth: 55,
        ...sx,
      }}
    />
  );
};

export interface SortBy {
  attr: string;
  order: "asc" | "desc";
}

export interface TableProps<T> {
  headers: Header[];
  headerStyle?: SxProps<Theme>;
  bodyStyle?: SxProps<Theme>;
  rows: RowData<T>[];
  footer?: Footer;
  footerStyle?: SxProps<Theme>;
  footerCellStyle?: SxProps<Theme>;
  onRowClick?: (row: RowData<T>) => void;
  actions?: (item: RowData<T>, idx: number) => React.ReactNode;
  selectable?: boolean;
  selectAllCellComponent?: React.ReactNode;
  selectAllCellStyle?: SxProps<Theme>;
  onRowSelected?: (row: RowData<T>, idx: number) => void;
  onAllRowsSelected?: () => void;
  isRowSelected?: (row: RowData<T>, idx: number) => boolean;
  areAllSelected?: boolean;
  sortedBy?: SortBy | null;
  sortBy?: (attr: string) => void;
}

export function Table<T>({
  headers,
  rows,
  footer,
  onRowClick,
  actions,
  selectable,
  selectAllCellComponent,
  selectAllCellStyle,
  onRowSelected,
  onAllRowsSelected,
  isRowSelected,
  areAllSelected,
  sortedBy,
  sortBy,
  ...props
}: TableProps<T>) {
  const [overRow, setOverRow] = React.useState<T | null>(null);

  return (
    <TableContainer sx={{ height: "100%" }}>
      <MUITable>
        <TableHead
          sx={{
            position: "sticky",
            top: 0,
            zIndex: 1000,
            ...props.headerStyle,
          }}
        >
          <TableRow>
            {selectable ? (
              <TableCell
                sx={{
                  padding: 0,
                  textAlign: "center",
                  ...selectAllCellStyle,
                }}
              >
                {selectAllCellComponent ?? (
                  <Checkbox
                    onClick={onAllRowsSelected}
                    checked={areAllSelected}
                  />
                )}
              </TableCell>
            ) : null}
            {headers.map((header) => (
              <TableCell key={header.attr} sx={header.columnStyle}>
                {header.sortable ? (
                  header.chip ? (
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <TableSortLabel
                        active={sortedBy?.attr == header.attr}
                        direction={sortedBy?.order}
                        onClick={() => sortBy?.(header.attr)}
                      >
                        {header.name}
                      </TableSortLabel>
                      <ChipCell {...header.chip} />
                    </Box>
                  ) : (
                    <TableSortLabel
                      active={sortedBy?.attr == header.attr}
                      direction={sortedBy?.order}
                      onClick={() => sortBy?.(header.attr)}
                    >
                      {header.name}
                    </TableSortLabel>
                  )
                ) : (
                  header.name
                )}
              </TableCell>
            ))}
            {actions ? <TableCell></TableCell> : null}
          </TableRow>
        </TableHead>
        <TableBody sx={props.bodyStyle}>
          {rows.map((r, index) => (
            <React.Fragment key={index}>
              <TableRow
                sx={
                  onRowClick
                    ? {
                        cursor: "pointer",
                        ...(overRow === r.data
                          ? {
                              backgroundColor: "rgba(0, 0, 0, 0.04)",
                            }
                          : {}),
                      }
                    : {}
                }
                onClick={() => onRowClick?.(r)}
                onMouseEnter={() => setOverRow(r.data || null)}
                onMouseLeave={() => setOverRow(null)}
              >
                {selectable ? (
                  <TableCell
                    sx={{ padding: 0, textAlign: "center", ...r.rowStyle }}
                  >
                    <Checkbox
                      onClick={() => onRowSelected?.(r, index)}
                      checked={isRowSelected?.(r, index)}
                    />
                  </TableCell>
                ) : null}
                {headers.map(
                  (header) =>
                    r.cells[header.attr] && (
                      <TableCell
                        key={header.attr}
                        rowSpan={r.cells[header.attr].rowSpan}
                        sx={
                          {
                            ...header.columnStyle,
                            ...r.rowStyle,
                            ...r.cells[header.attr].cellStyle,
                          } as SxProps<Theme>
                        }
                      >
                        {header.type === "label"
                          ? typeof r.cells[header.attr].value === "number"
                            ? formatNumber(r.cells[header.attr].value as number)
                            : r.cells[header.attr].value
                          : null}
                        {header.type === "chip" ? (
                          <ChipCell
                            label={r.cells[header.attr].value || ""}
                            sx={r.cells[header.attr].chipStyle}
                          />
                        ) : null}
                        {header.type === "icon"
                          ? r.cells[header.attr].icon
                          : null}
                      </TableCell>
                    )
                )}
                {r.haveActions && actions ? (
                  <TableCell
                    sx={{ padding: 0, ...r.rowStyle }}
                    rowSpan={r.cells["actions"]?.rowSpan}
                  >
                    {actions(r, index)}
                  </TableCell>
                ) : null}
              </TableRow>
              {r.isOpen &&
                r.foldedRows?.map((fr, frIdx) => (
                  <TableRow
                    key={`${index}-${frIdx}`}
                    onClick={() => onRowClick?.(r)}
                  >
                    {selectable ? (
                      <TableCell
                        sx={{ padding: 0, ...fr.rowStyle }}
                      ></TableCell>
                    ) : null}
                    {headers.map(
                      (header) =>
                        fr.cells[header.attr] && (
                          <TableCell
                            key={`${frIdx}-${header.attr}`}
                            rowSpan={fr.cells[header.attr].rowSpan}
                            sx={fr.rowStyle}
                          >
                            {header.type === "label"
                              ? typeof fr.cells[header.attr].value === "number"
                                ? formatNumber(
                                    fr.cells[header.attr].value as number
                                  )
                                : fr.cells[header.attr].value
                              : null}
                            {header.type === "chip" ? (
                              <ChipCell
                                label={fr.cells[header.attr].value || ""}
                                sx={fr.cells[header.attr].chipStyle}
                              />
                            ) : null}
                            {header.type === "icon"
                              ? fr.cells[header.attr].icon
                              : null}
                          </TableCell>
                        )
                    )}
                    {r.haveActions && actions ? (
                      <TableCell sx={fr.rowStyle}></TableCell>
                    ) : null}
                  </TableRow>
                ))}
            </React.Fragment>
          ))}
        </TableBody>
        {footer && (
          <TableFooter
            sx={{ position: "sticky", bottom: 0, ...props.footerStyle }}
          >
            <TableRow>
              {headers.map((header) => (
                <TableCell
                  key={header.attr}
                  sx={
                    {
                      ...header.columnStyle,
                      ...props.footerCellStyle,
                      border: "unset",
                    } as SxProps<Theme>
                  }
                >
                  {footer[header.attr]}
                </TableCell>
              ))}
            </TableRow>
          </TableFooter>
        )}
      </MUITable>
    </TableContainer>
  );
}
