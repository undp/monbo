"use client";

import { Box, SxProps, Theme } from "@mui/material";
import { FLOW_COLORS, HEADING_FONT, STAGE_CARD } from "./flowStyles";

interface Props {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  /** At the right of the heading, e.g. a "Remove all" link. */
  action?: React.ReactNode;
  sx?: SxProps<Theme>;
  children: React.ReactNode;
}

/** A card of a stage page, under an icon and a heading. */
export const FlowSection: React.FC<Props> = ({
  title,
  subtitle,
  icon,
  action,
  sx,
  children,
}) => (
  <Box
    component="section"
    aria-label={title}
    sx={{ ...STAGE_CARD, padding: { xs: 2, md: "22px 24px" }, ...sx }}
  >
    <Box
      sx={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        columnGap: 1.5,
        // A wide action (a search) goes under the heading on a narrow screen
        rowGap: 1.5,
        marginBottom: 2,
      }}
    >
      <Box
        aria-hidden
        sx={{
          width: 38,
          height: 38,
          flex: "none",
          borderRadius: "10px",
          display: "grid",
          placeItems: "center",
          backgroundColor: FLOW_COLORS.mint,
          color: FLOW_COLORS.leafDark,
        }}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Box
          component="h2"
          sx={{
            margin: 0,
            fontFamily: HEADING_FONT,
            fontSize: 18,
            fontWeight: 700,
            lineHeight: 1.2,
            letterSpacing: "-0.015em",
            color: FLOW_COLORS.ink,
          }}
        >
          {title}
        </Box>
        {subtitle && (
          <Box
            component="p"
            sx={{ margin: 0, fontSize: 13.5, color: FLOW_COLORS.muted }}
          >
            {subtitle}
          </Box>
        )}
      </Box>
      {action && <Box sx={{ marginLeft: "auto" }}>{action}</Box>}
    </Box>
    {children}
  </Box>
);
