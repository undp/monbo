"use client";

import React from "react";
import { Box, alpha, useTheme } from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import { useTranslation } from "react-i18next";

export type StepStatus = "pending" | "active" | "done";

export interface RasterStep {
  title: string;
  subtitle: string;
  status: StepStatus;
}

/** The raster upload's step indicator: a bar and a numbered circle per step. */
export const RasterSteps: React.FC<{ steps: RasterStep[] }> = ({ steps }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const primary = theme.palette.primary.main;
  const pendingColor = theme.palette.grey[300];

  return (
    <Box
      component="ol"
      sx={{
        display: "grid",
        gridTemplateColumns: `repeat(${steps.length}, 1fr)`,
        gap: 1.5,
        listStyle: "none",
        margin: 0,
        padding: 0,
      }}
    >
      {steps.map(({ title, subtitle, status }, index) => (
        <Box
          component="li"
          key={title}
          aria-current={status === "active" ? "step" : undefined}
        >
          <Box
            sx={{
              height: 4,
              borderRadius: 2,
              marginBottom: 1.5,
              backgroundColor:
                status === "done"
                  ? primary
                  : status === "active"
                    ? alpha(primary, 0.55)
                    : pendingColor,
            }}
          />
          <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start" }}>
            <Box
              sx={{
                flexShrink: 0,
                width: 32,
                height: 32,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 14,
                fontWeight: 500,
                boxSizing: "border-box",
                ...(status === "done"
                  ? { backgroundColor: primary, color: "common.white" }
                  : {
                      backgroundColor: "common.white",
                      border: `2px solid ${status === "active" ? primary : pendingColor}`,
                      color: status === "active" ? primary : "text.secondary",
                    }),
              }}
            >
              {status === "done" ? <CheckIcon sx={{ fontSize: 18 }} /> : index + 1}
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Box
                sx={{
                  fontSize: 11,
                  letterSpacing: ".08em",
                  textTransform: "uppercase",
                  color: "text.secondary",
                }}
              >
                {t("admin:raster:steps:label", { number: index + 1 })}
              </Box>
              <Box
                sx={{
                  fontSize: 15,
                  fontWeight: 500,
                  color: status === "pending" ? "text.secondary" : "text.primary",
                }}
              >
                {title}
              </Box>
              <Box
                sx={{
                  fontSize: 13,
                  color: "text.secondary",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={subtitle}
              >
                {subtitle}
              </Box>
            </Box>
          </Box>
        </Box>
      ))}
    </Box>
  );
};
