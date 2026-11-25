"use client";

import { Box } from "@mui/material";
import PentagonOutlinedIcon from "@mui/icons-material/PentagonOutlined";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import { useTranslation } from "react-i18next";
import { FLOW_COLORS } from "./flowStyles";

/** "Polígono" or "Punto" in a farm table, after its icon. */
export const FarmTypeLabel: React.FC<{ point: boolean }> = ({ point }) => {
  const { t } = useTranslation();
  const Icon = point ? PlaceOutlinedIcon : PentagonOutlinedIcon;
  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.75,
        whiteSpace: "nowrap",
        color: FLOW_COLORS.ink2,
      }}
    >
      <Icon aria-hidden sx={{ fontSize: 17, color: FLOW_COLORS.muted }} />
      {t(point ? "common:point" : "common:polygon")}
    </Box>
  );
};
