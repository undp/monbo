"use client";

import { Box } from "@mui/material";
import { FLOW_COLORS } from "./flowStyles";

interface Props {
  /** What the stage will act on: counts (`SummaryStat`) and notes, at the left. */
  children: React.ReactNode;
  /** The stage's next step, at the right: "Continuar", "Analizar". */
  action: React.ReactNode;
}

/**
 * The bar at the bottom of a stage page, sticky while the page scrolls: what the
 * next step will act on, and the button that takes it. It spans the viewport
 * while its content stays aligned with the page's (`FlowPage` clips the overflow).
 */
export const FlowBottomBar: React.FC<Props> = ({ children, action }) => (
  <Box
    sx={{
      position: "sticky",
      bottom: 0,
      zIndex: 2,
      marginX: "calc(50% - 50vw)",
      paddingX: "calc(50vw - 50%)",
      // Down to the page's edge: FlowPage's bottom padding
      marginBottom: { xs: -1.5, md: -3 },
      minHeight: 72,
      display: "flex",
      flexWrap: "wrap",
      alignItems: "center",
      columnGap: 2.25,
      rowGap: 1,
      paddingY: 1.5,
      backgroundColor: FLOW_COLORS.white,
      borderTop: `1px solid ${FLOW_COLORS.line}`,
      boxShadow: "0 -8px 24px rgba(11, 37, 69, 0.06)",
    }}
  >
    {children}
    <Box sx={{ marginLeft: "auto" }}>{action}</Box>
  </Box>
);
