import { Box } from "@mui/material";
import { FLOW_COLORS } from "./flowStyles";

/** The green, spaced uppercase line above a page's title (mockup v2). */
export const PageEyebrow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Box
    component="span"
    sx={{
      display: "block",
      fontSize: 12,
      fontWeight: 700,
      lineHeight: 1,
      letterSpacing: "0.16em",
      textTransform: "uppercase",
      color: FLOW_COLORS.eyebrow,
      marginBottom: 1,
    }}
  >
    {children}
  </Box>
);
