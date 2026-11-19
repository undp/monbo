"use client";

import { Box } from "@mui/material";
import { stagePageBackground } from "./flowStyles";

/** A stage page's body, under the flow header: the leaves background and its gutter. */
export const FlowPage: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Box
    sx={{
      background: stagePageBackground,
      padding: { xs: 1.5, md: 3 },
      paddingTop: { xs: 3, md: 3.75 },
      display: "flex",
      flexDirection: "column",
      gap: 2.25,
    }}
  >
    {children}
  </Box>
);
