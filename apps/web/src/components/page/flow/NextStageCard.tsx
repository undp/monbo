"use client";

import { Box, Button } from "@mui/material";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import { useTranslation } from "react-i18next";
import type { FlowStage } from "@/utils/flowStages";
import {
  FLOW_COLORS,
  HEADING_FONT,
  REDUCED_MOTION,
  nextStageBackground,
  rise,
} from "./flowStyles";

interface Props {
  stage: FlowStage;
  title: string;
  description: string;
  onContinue: () => void;
}

/** Closes a stage: what comes next and a "Continue" button. */
export const NextStageCard: React.FC<Props> = ({ stage, title, description, onContinue }) => {
  const { t } = useTranslation();

  return (
    <Box
      component="section"
      aria-label={t("flow:nextStage.eyebrow")}
      sx={{
        borderRadius: 4.5,
        color: FLOW_COLORS.white,
        padding: { xs: "20px", md: "24px 28px" },
        display: "flex",
        flexDirection: { xs: "column", sm: "row" },
        alignItems: { xs: "flex-start", sm: "center" },
        gap: { xs: 2, sm: 2.75 },
        background: nextStageBackground,
        boxShadow: "0 18px 40px rgba(14, 59, 48, 0.25)",
        animation: `${rise} 0.5s ease both`,
        [REDUCED_MOTION]: { animation: "none" },
      }}
    >
      <Box
        aria-hidden
        sx={{
          width: 52,
          height: 52,
          flex: "none",
          borderRadius: "50%",
          border: "2px dashed rgba(255, 255, 255, 0.5)",
          display: "grid",
          placeItems: "center",
          fontFamily: HEADING_FONT,
          fontWeight: 800,
          fontSize: 20,
        }}
      >
        {stage}
      </Box>
      <Box sx={{ flexGrow: 1 }}>
        <Box
          component="span"
          sx={{
            display: "block",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: FLOW_COLORS.leaf,
          }}
        >
          {t("flow:nextStage.eyebrow")}
        </Box>
        <Box
          component="h3"
          sx={{ margin: 0, marginTop: 0.75, fontFamily: HEADING_FONT, fontSize: 22, fontWeight: 700 }}
        >
          {title}
        </Box>
        <Box component="p" sx={{ margin: 0, marginTop: 0.5, fontSize: 14, opacity: 0.8 }}>
          {description}
        </Box>
      </Box>
      <Button
        onClick={onContinue}
        endIcon={<ArrowForwardRoundedIcon />}
        sx={{
          flex: "none",
          backgroundColor: FLOW_COLORS.white,
          color: FLOW_COLORS.forestInk,
          fontWeight: 600,
          textTransform: "none",
          borderRadius: 2.5,
          paddingX: 2.5,
          paddingY: 1.5,
          "&:hover": { backgroundColor: "rgba(255, 255, 255, 0.88)" },
        }}
      >
        {t("flow:nextStage.continue")}
      </Button>
    </Box>
  );
};
