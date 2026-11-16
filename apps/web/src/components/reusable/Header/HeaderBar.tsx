"use client";

import { AppBar, useTheme } from "@mui/material";
import { useIsStartPage } from "@/hooks/useIsStartPage";

/**
 * The header's bar. On the start page it is drawn over the hero, transparent and
 * white; everywhere else it is a fixed white bar.
 */
export const HeaderBar: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const startPage = useIsStartPage();
  const theme = useTheme();
  const colors = theme.palette.landing;

  return (
    <AppBar
      position={startPage ? "absolute" : "fixed"}
      elevation={0}
      data-variant={startPage ? "dark" : "light"}
      sx={
        startPage
          ? {
              backgroundColor: "transparent",
              color: "common.white",
              borderBottom: "1px solid rgba(255,255,255,.1)",
            }
          : {
              backgroundColor: "white",
              color: theme.palette.text.primary,
              borderBottom: `1px solid ${colors.line}`,
            }
      }
    >
      {children}
    </AppBar>
  );
};
