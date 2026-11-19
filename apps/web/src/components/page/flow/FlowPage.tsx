"use client";

import { Box } from "@mui/material";
import { FLOW_CONTENT_MAX_WIDTH, stagePageBackground } from "./flowStyles";

/**
 * A stage page's body, under the flow header: the leaves background, and its
 * content as wide as the header's stepper and aligned with it.
 */
export const FlowPage: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Box
    sx={{
      background: stagePageBackground,
      paddingX: { xs: 2, md: 3 },
      paddingTop: { xs: 3, md: 3.75 },
      paddingBottom: { xs: 1.5, md: 3 },
      // A full-width band inside (the upload's bottom bar) reaches the viewport's
      // edges; `clip` keeps it from adding a horizontal scroll, and unlike
      // `hidden` it keeps that band sticky.
      overflowX: "clip",
    }}
  >
    <Box
      sx={{
        maxWidth: FLOW_CONTENT_MAX_WIDTH,
        marginX: "auto",
        display: "flex",
        flexDirection: "column",
        gap: 2.25,
      }}
    >
      {children}
    </Box>
  </Box>
);
