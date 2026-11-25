"use client";

import { Box } from "@mui/material";
import { StageEyebrow } from "./StageEyebrow";
import { FLOW_COLORS, HEADING_FONT } from "./flowStyles";

interface Props {
  /** Above the title; "Stage N of 3" by default. */
  eyebrow?: React.ReactNode;
  title: string;
  subtitle?: string;
  /** Next to the title, at the right: a search bar or a download button. */
  actions?: React.ReactNode;
}

/** A stage page's head: "Stage N of 3", its title and what to do in it. */
export const FlowPageHead: React.FC<Props> = ({
  eyebrow = <StageEyebrow />,
  title,
  subtitle,
  actions,
}) => (
  <Box
    sx={{
      display: "flex",
      flexWrap: "wrap",
      alignItems: "flex-end",
      gap: 3,
    }}
  >
    <Box sx={{ flex: "1 1 420px", minWidth: 0 }}>
      {eyebrow}
      <Box
        component="h1"
        sx={{
          margin: 0,
          marginTop: 1,
          fontFamily: HEADING_FONT,
          fontSize: { xs: 26, md: 32 },
          fontWeight: 800,
          lineHeight: 1.15,
          letterSpacing: "-0.015em",
          color: FLOW_COLORS.ink,
        }}
      >
        {title}
      </Box>
      {subtitle && (
        <Box
          component="p"
          sx={{
            margin: 0,
            marginTop: 0.75,
            maxWidth: 680,
            fontSize: 15,
            lineHeight: 1.5,
            color: FLOW_COLORS.ink2,
          }}
        >
          {subtitle}
        </Box>
      )}
    </Box>
    {actions}
  </Box>
);
