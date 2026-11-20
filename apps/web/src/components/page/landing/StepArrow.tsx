"use client";

import { Box, useTheme } from "@mui/material";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { entrance } from "./entrance";

/** The arrow between two step cards: right on wide screens, down when stacked. */
export const StepArrow: React.FC<{ delay: number }> = ({ delay }) => {
  const colors = useTheme().palette.landing;
  return (
    <Box
      aria-hidden
      sx={{
        display: "grid",
        placeItems: "center",
        width: { xs: "auto", md: 34 },
        height: { xs: 30, md: "auto" },
        color: colors.leaf,
        "& svg": { rotate: { xs: "90deg", md: "0deg" } },
        ...entrance(delay),
      }}
    >
      <ArrowForwardIcon sx={{ fontSize: 26 }} />
    </Box>
  );
};
