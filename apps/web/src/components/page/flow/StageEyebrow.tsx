"use client";

import { Box } from "@mui/material";
import { useTranslation } from "react-i18next";
import { useFlowStages } from "@/hooks/useFlowStages";
import { FLOW_COLORS } from "./flowStyles";

/** "Stage N of 3", above a stage page's title. */
export const StageEyebrow: React.FC = () => {
  const { t } = useTranslation();
  const { current } = useFlowStages();
  if (!current) return null;

  return (
    <Box
      component="span"
      sx={{
        display: "block",
        fontSize: 12,
        fontWeight: 700,
        lineHeight: 1,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        color: FLOW_COLORS.leafDark,
        marginBottom: 1,
      }}
    >
      {t("flow:stageOf", { stage: current })}
    </Box>
  );
};
