"use client";

import { Box, useTheme } from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import { useTranslation } from "react-i18next";

const STATEMENTS = ["undp", "layers", "languages"] as const;

/** Who backs Monbo and what it offers, under the start bar (wide screens only). */
export const LandingTrust: React.FC = () => {
  const { t } = useTranslation();
  const colors = useTheme().palette.landing;

  return (
    <Box
      component="ul"
      sx={{
        display: { xs: "none", md: "flex" },
        justifyContent: "center",
        gap: 3.5,
        listStyle: "none",
        margin: 0,
        padding: "16px 0 24px",
        fontSize: 13,
        color: colors.muted,
      }}
    >
      {STATEMENTS.map((key) => (
        <Box component="li" key={key} sx={{ display: "flex", alignItems: "center", gap: "7px" }}>
          <CheckIcon aria-hidden sx={{ fontSize: 16, color: colors.leaf }} />
          {t(`home:landing:trust:${key}`)}
        </Box>
      ))}
    </Box>
  );
};
