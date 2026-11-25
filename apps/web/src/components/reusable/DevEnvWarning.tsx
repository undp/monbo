"use client";

import { Box, Typography } from "@mui/material";
import WarningIcon from "@mui/icons-material/Warning";
import { useTranslation } from "react-i18next";

export const DevEnvWarning: React.FC = () => {
  const { t } = useTranslation();
  return (
    <Box sx={{ width: "max-content" }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          height: "max-content",
          color: "#ED6C02",
          backgroundColor: "#FFF5E5",
          padding: "4px 16px",
          fontSize: "12px",
          borderRadius: 1,
        }}
      >
        <WarningIcon fontSize="medium" sx={{ marginRight: 0.5 }} />
        <Typography
          variant="body2"
          sx={{ marginLeft: "5px", color: "#663C00", fontWeight: 500 }}
        >
          {t("home:devWarning")}
        </Typography>
      </Box>
    </Box>
  );
};
