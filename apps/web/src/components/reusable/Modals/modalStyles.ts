// The v2 modal's paper and footer, shared by every modal with `ModalHeader`.

import { FLOW_COLORS } from "@/components/page/flow/flowStyles";

/** The modal's paper: rounder and with a softer shadow than MUI's. */
export const MODAL_PAPER = {
  borderRadius: "16px",
  boxShadow: "0 24px 60px rgba(11, 37, 69, 0.22)",
} as const;

/** The modal's padding, under the heading and in the footer. */
export const MODAL_PADDING = { xs: 2, md: 3 } as const;

/** A footer of actions on the right, over a hairline. */
export const MODAL_FOOTER = {
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "flex-end",
  gap: 1,
  padding: { xs: "12px 16px", md: "14px 24px" },
  borderTop: `1px solid ${FLOW_COLORS.line}`,
} as const;
