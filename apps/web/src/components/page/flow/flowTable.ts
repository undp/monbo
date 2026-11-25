import { FLOW_COLORS } from "./flowStyles";

// The look of a stage page's farm tables (mockup v2): the upload list and the
// validation results.

/** The table's frame: a hairline border with round corners; long lists scroll inside. */
export const FLOW_TABLE_FRAME = {
  border: `1px solid ${FLOW_COLORS.line}`,
  borderRadius: "12px",
  overflow: "auto",
  backgroundColor: FLOW_COLORS.white,
} as const;

/**
 * Small uppercase headers on a light band, and roomy rows. Long texts wrap, so the
 * table fits its card instead of scrolling sideways.
 */
export const FLOW_TABLE_SX = {
  "& th": {
    padding: "12px 16px",
    fontSize: 11.5,
    fontWeight: 700,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    lineHeight: 1.4,
    color: FLOW_COLORS.muted,
    backgroundColor: FLOW_COLORS.blue25,
    borderBottom: `1px solid ${FLOW_COLORS.line}`,
    whiteSpace: "nowrap",
  },
  "& td": {
    padding: "16px",
    fontSize: 14,
    lineHeight: 1.45,
    color: FLOW_COLORS.ink,
    borderBottom: `1px solid ${FLOW_COLORS.line}`,
    overflowWrap: "anywhere",
  },
  "& tbody tr:last-of-type td": { borderBottom: "none" },
} as const;

/** A farm's ID in its row: blue, as the mockup's. */
export const FLOW_TABLE_ID = {
  color: FLOW_COLORS.blue,
  fontWeight: 600,
  whiteSpace: "nowrap",
} as const;

/** A result's pill: the class's color on its tint (ok, with findings, no data). */
export const FLOW_RESULT_PILL = {
  ok: { color: FLOW_COLORS.ok, backgroundColor: FLOW_COLORS.okBackground },
  flagged: { color: FLOW_COLORS.bad, backgroundColor: FLOW_COLORS.badBackground },
  unknown: { color: FLOW_COLORS.muted, backgroundColor: FLOW_COLORS.blue50 },
} as const;

/**
 * The same look with compact rows, for a table inside a modal or a panel (vertices,
 * attribute names, a farm's points). Applies to every table under the element.
 */
export const FLOW_TABLE_COMPACT_SX = {
  ...FLOW_TABLE_SX,
  "& th": { ...FLOW_TABLE_SX["& th"], padding: "8px 14px" },
  "& td": { ...FLOW_TABLE_SX["& td"], padding: "8px 14px", fontSize: 13.5 },
} as const;
