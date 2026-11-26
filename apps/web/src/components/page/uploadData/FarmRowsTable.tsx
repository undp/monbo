"use client";

import { useRef } from "react";
import {
  Box,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useTranslation } from "react-i18next";
import { FarmTypeLabel } from "@/components/page/flow/FarmTypeLabel";
import { FLOW_COLORS } from "@/components/page/flow/flowStyles";
import {
  FLOW_TABLE_FRAME,
  FLOW_TABLE_ID,
  FLOW_TABLE_SX,
} from "@/components/page/flow/flowTable";
import { FarmRow } from "@/interfaces/FarmRow";
import { formatNumber } from "@/utils/numbers";
import {
  ManualSource,
  UploadSource,
  rowMark,
  sourceListedRows,
} from "@/utils/uploadSources";

/** "48,5 kg", in the user's language; empty when the row has no quantity. */
const productionText = (row: FarmRow, language: string): string => {
  const quantity = row.productionQuantity;
  if (quantity === null || quantity === undefined || quantity === "") return "";
  const amount =
    typeof quantity === "number" ? formatNumber(quantity, 2, language) : quantity;
  return [amount, row.productionQuantityUnit].filter(Boolean).join(" ");
};

const EMPTY_CELL = "—";

// Read by screen readers, not shown
const VISUALLY_HIDDEN = {
  position: "absolute",
  width: 1,
  height: 1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
} as const;

// On a phone the crop and the production give way to the rest
const WIDE_ONLY = { display: { xs: "none", sm: "table-cell" } } as const;

const COLUMNS = 7;
const MAX_HEIGHT = 520;
/** Lists longer than this only render the rows in view (and a few around). */
export const VIRTUALIZE_FROM = 100;
/** A one-line row; longer texts wrap, and each row is measured once drawn. */
const ESTIMATED_ROW_HEIGHT = 53;

interface FarmRowsTableProps {
  sources: UploadSource[];
  onRemoveRow: (source: UploadSource, index: number) => void;
  onEdit: (source: ManualSource) => void;
}

/**
 * One row per farm to upload, in list order: its ID, producer, crop, production,
 * kind and where it came from, with a button to delete it (and to edit a drawn
 * one). The area isn't known yet: the API computes it. Long lists scroll inside,
 * and from `VIRTUALIZE_FROM` rows on only the visible ones are in the page, so a
 * file of thousands of farms stays responsive.
 */
export const FarmRowsTable: React.FC<FarmRowsTableProps> = ({
  sources,
  onRemoveRow,
  onEdit,
}) => {
  const { t, i18n } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const rows = sources.flatMap((source) =>
    sourceListedRows(source).map(({ row, index }) => ({ source, row, index }))
  );
  const virtualize = rows.length > VIRTUALIZE_FROM;
  // eslint-disable-next-line react-hooks/incompatible-library -- its functions are read during render, never memoized
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: 8,
    enabled: virtualize,
    // Before the first measure (and in tests): the frame's full height
    initialRect: { width: 0, height: MAX_HEIGHT },
  });
  if (rows.length === 0) return null;

  const items = virtualize ? virtualizer.getVirtualItems() : null;
  const shown = items
    ? items.map(({ index }) => index)
    : rows.map((_, index) => index);
  const spaceAbove = items?.length ? items[0].start : 0;
  const spaceBelow = items?.length
    ? virtualizer.getTotalSize() - items[items.length - 1].end
    : 0;
  const spacer = (height: number) =>
    height > 0 && (
      <tr aria-hidden>
        <td colSpan={COLUMNS} style={{ height, padding: 0, border: 0 }} />
      </tr>
    );

  const header = (key: string) => t(`common:farmsUpload:table:${key}`);
  return (
    <Box ref={scrollRef} sx={{ ...FLOW_TABLE_FRAME, maxHeight: MAX_HEIGHT }}>
      <Table
        stickyHeader
        aria-label={t("common:farmsUpload:listTitle")}
        // With part of the rows out of the page, say how many there are
        aria-rowcount={virtualize ? rows.length + 1 : undefined}
        sx={FLOW_TABLE_SX}
      >
        <TableHead>
          <TableRow aria-rowindex={virtualize ? 1 : undefined}>
            <TableCell>{header("id")}</TableCell>
            <TableCell>{header("producer")}</TableCell>
            <TableCell sx={WIDE_ONLY}>{header("crop")}</TableCell>
            <TableCell sx={WIDE_ONLY}>{header("production")}</TableCell>
            <TableCell>{header("type")}</TableCell>
            <TableCell>{header("origin")}</TableCell>
            <TableCell align="right">
              <Box component="span" sx={VISUALLY_HIDDEN}>
                {header("actions")}
              </Box>
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {spacer(spaceAbove)}
          {shown.map((position) => {
            const { source, row, index } = rows[position];
            const id = row.id ? String(row.id) : null;
            const name = id ?? row.producerName ?? t("common:farmsUpload:manualFarm");
            const mark = rowMark(source, index);
            return (
              <TableRow
                key={`${source.key}-${index}`}
                hover
                data-index={position}
                ref={virtualize ? virtualizer.measureElement : undefined}
                aria-rowindex={virtualize ? position + 2 : undefined}
              >
                <TableCell>
                  <Box
                    component="span"
                    sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}
                  >
                    {mark && (
                      <Tooltip
                        title={
                          <Box component="ul" sx={{ m: 0, pl: 2 }}>
                            {mark.messages.map((message, at) => (
                              <li key={at}>{message}</li>
                            ))}
                          </Box>
                        }
                      >
                        <Box
                          component="span"
                          role="img"
                          tabIndex={0}
                          aria-label={t("common:farmsUpload:table:rowProblems", {
                            name,
                            problems: mark.messages.join(" "),
                            interpolation: { escapeValue: false },
                          })}
                          sx={{
                            display: "inline-flex",
                            color: FLOW_COLORS[mark.tone],
                          }}
                        >
                          {mark.tone === "warn" ? (
                            <WarningAmberRoundedIcon fontSize="small" aria-hidden />
                          ) : (
                            <ErrorOutlineRoundedIcon fontSize="small" aria-hidden />
                          )}
                        </Box>
                      </Tooltip>
                    )}
                    <Box component="span" sx={FLOW_TABLE_ID}>
                      {id ?? EMPTY_CELL}
                    </Box>
                  </Box>
                </TableCell>
                <TableCell>{row.producerName || EMPTY_CELL}</TableCell>
                <TableCell sx={WIDE_ONLY}>{row.cropType || EMPTY_CELL}</TableCell>
                <TableCell sx={{ ...WIDE_ONLY, whiteSpace: "nowrap" }}>
                  {productionText(row, i18n.language) || EMPTY_CELL}
                </TableCell>
                <TableCell>
                  <FarmTypeLabel point={row.geometryType === "Point"} />
                </TableCell>
                <TableCell sx={{ color: `${FLOW_COLORS.ink2} !important` }}>
                  {source.kind === "manual"
                    ? t("common:farmsUpload:table:drawn")
                    : source.name}
                </TableCell>
                <TableCell
                  align="right"
                  sx={{
                    whiteSpace: "nowrap",
                    paddingY: "0 !important",
                    paddingX: "8px !important",
                  }}
                >
                  {source.kind === "manual" && (
                    <Tooltip title={t("common:farmsUpload:edit")}>
                      <IconButton
                        size="small"
                        aria-label={t("common:farmsUpload:table:editRow", {
                          name,
                          interpolation: { escapeValue: false },
                        })}
                        onClick={() => onEdit(source)}
                      >
                        <EditOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                  <Tooltip title={t("common:farmsUpload:remove")}>
                    <IconButton
                      size="small"
                      aria-label={t("common:farmsUpload:table:removeRow", {
                        name,
                        interpolation: { escapeValue: false },
                      })}
                      onClick={() => onRemoveRow(source, index)}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            );
          })}
          {spacer(spaceBelow)}
        </TableBody>
      </Table>
    </Box>
  );
};
