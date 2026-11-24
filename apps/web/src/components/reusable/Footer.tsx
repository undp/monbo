"use client";

import { AppBar, Box, Toolbar } from "@mui/material";
import { SHOW_TESTING_ENVIRONMENT_WARNING } from "@/config/env";
import { DevEnvWarning } from "./DevEnvWarning";

interface FooterProps {
  /** The page's actions, shown on the right. */
  children?: React.ReactNode;
}

export const Footer: React.FC<FooterProps> = ({ children }) => {
  return (
    <AppBar sx={{ top: "unset", bottom: 0, backgroundColor: "white" }}>
      <Toolbar sx={{ gap: 2 }}>
        {SHOW_TESTING_ENVIRONMENT_WARNING && <DevEnvWarning />}
        {/* `ml: auto` keeps the actions on the right with or without the warning. */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, ml: "auto" }}>
          {children}
        </Box>
      </Toolbar>
    </AppBar>
  );
};
