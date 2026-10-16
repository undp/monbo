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
} from "@mui/material";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";

export interface Header {
  name: React.ReactNode;
  attr: string;
  type: "label" | "chip" | "icon";
  sortable?: boolean;
  columnStyle?: SxProps<Theme>;
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
  onAllRowsSelected?: (rows: RowData<T>[]) => void;
  isRowSelected?: (row: RowData<T>, idx: number) => boolean;
  areAllSelected?: boolean;
  sortedBy?: SortBy | null;
  sortBy?: (attr: string) => void;
}

const CLICKABLE_ROW_SX = { cursor: "pointer" };
const HOVERED_ROW_SX = { cursor: "pointer", backgroundColor: "rgba(0, 0, 0, 0.04)" };

const cellContent = <T,>(row: RowData<T>, header: Header, language: string) => {
  const cell = row.cells[header.attr];
  return (
    <>
      {header.type === "label"
        ? typeof cell.value === "number"
          ? formatNumber(cell.value as number, 2, language)
          : cell.value
        : null}
      {header.type === "chip" && cell.value !== null ? (
        <ChipCell label={cell.value || ""} sx={cell.chipStyle} />
      ) : null}
      {header.type === "icon" ? cell.icon : null}
    </>
  );
};

interface RowCellsProps<T> {
  row: RowData<T>;
  index: number;
  headers: Header[];
  actions?: TableProps<T>["actions"];
  language: string;
}

// A row's cells, kept apart from its checkbox and hover: with 1000 rows, checking
// one (or all) re-renders the checkboxes, not every cell.
const RowCells = React.memo(function RowCells<T>({
  row,
  index,
  headers,
  actions,
  language,
}: RowCellsProps<T>) {
  return (
    <>
      {headers.map(
        (header) =>
          row.cells[header.attr] && (
            <TableCell
              key={header.attr}
              rowSpan={row.cells[header.attr].rowSpan}
              sx={
                {
                  ...header.columnStyle,
                  ...row.rowStyle,
                  ...row.cells[header.attr].cellStyle,
                } as SxProps<Theme>
              }
            >
              {cellContent(row, header, language)}
            </TableCell>
          )
      )}
      {row.haveActions && actions ? (
        <TableCell
          sx={{ padding: 0, ...row.rowStyle }}
          rowSpan={row.cells["actions"]?.rowSpan}
        >
          {actions(row, index)}
        </TableCell>
      ) : null}
    </>
  );
}) as <T>(props: RowCellsProps<T>) => React.ReactElement;

interface BodyRowProps<T> extends RowCellsProps<T> {
  selectable?: boolean;
  selected: boolean;
  onRowSelected?: TableProps<T>["onRowSelected"];
  onRowClick?: TableProps<T>["onRowClick"];
  hovered: boolean;
  onHover?: (data: T | null) => void;
}

const BodyRow = React.memo(function BodyRow<T>({
  row,
  index,
  headers,
  selectable,
  selected,
  onRowSelected,
  onRowClick,
  hovered,
  onHover,
  actions,
  language,
}: BodyRowProps<T>) {
  return (
    <>
      <TableRow
        sx={onRowClick ? (hovered ? HOVERED_ROW_SX : CLICKABLE_ROW_SX) : undefined}
        onClick={onRowClick ? () => onRowClick(row) : undefined}
        onMouseEnter={onHover ? () => onHover(row.data ?? null) : undefined}
        onMouseLeave={onHover ? () => onHover(null) : undefined}
      >
        {selectable ? (
          <TableCell sx={{ padding: 0, textAlign: "center", ...row.rowStyle }}>
            <Checkbox
              onClick={() => onRowSelected?.(row, index)}
              checked={selected}
            />
          </TableCell>
        ) : null}
        <RowCells
          row={row}
          index={index}
          headers={headers}
          actions={actions}
          language={language}
        />
      </TableRow>
      {row.isOpen &&
        row.foldedRows?.map((fr, frIdx) => (
          <TableRow key={`${index}-${frIdx}`} onClick={() => onRowClick?.(row)}>
            {selectable ? (
              <TableCell sx={{ padding: 0, ...fr.rowStyle }}></TableCell>
            ) : null}
            {headers.map(
              (header) =>
                fr.cells[header.attr] && (
                  <TableCell
                    key={`${frIdx}-${header.attr}`}
                    rowSpan={fr.cells[header.attr].rowSpan}
                    sx={fr.rowStyle}
                  >
                    {header.type === "chip" ? (
                      <ChipCell
                        label={fr.cells[header.attr].value || ""}
                        sx={fr.cells[header.attr].chipStyle}
                      />
                    ) : (
                      cellContent(fr, header, language)
                    )}
                  </TableCell>
                )
            )}
            {row.haveActions && actions ? (
              <TableCell sx={fr.rowStyle}></TableCell>
            ) : null}
          </TableRow>
        ))}
    </>
  );
}) as <T>(props: BodyRowProps<T>) => React.ReactElement;

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
  const [overRow, setOverRow] = useState<T | null>(null);
  const { i18n } = useTranslation();

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
                    onClick={() => onAllRowsSelected?.(rows)}
                    checked={areAllSelected}
                  />
                )}
              </TableCell>
            ) : null}
            {headers.map((header) => (
              <TableCell key={header.attr} sx={header.columnStyle}>
                {header.sortable ? (
                  <TableSortLabel
                    active={sortedBy?.attr == header.attr}
                    direction={sortedBy?.order}
                    onClick={() => sortBy?.(header.attr)}
                  >
                    {header.name}
                  </TableSortLabel>
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
            <BodyRow
              key={index}
              row={r}
              index={index}
              headers={headers}
              selectable={selectable}
              selected={!!selectable && !!isRowSelected?.(r, index)}
              onRowSelected={onRowSelected}
              onRowClick={onRowClick}
              // Rows that share `data` (one inconsistency over several rows) are
              // highlighted together.
              hovered={!!onRowClick && r.data !== undefined && overRow === r.data}
              onHover={onRowClick ? setOverRow : undefined}
              actions={actions}
              language={i18n.language}
            />
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
