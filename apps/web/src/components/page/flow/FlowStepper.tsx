"use client";

import { Fragment, useCallback, useContext, useState } from "react";
import { Box, ButtonBase } from "@mui/material";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { DataContext } from "@/context/DataContext";
import { useFlowStages } from "@/hooks/useFlowStages";
import { localizedPath } from "@/utils/languageChange";
import {
  stageAction,
  stageHref,
  type FlowStage,
  type FlowStageView,
} from "@/utils/flowStages";
import { MapSelectionModal } from "@/components/page/territorialAnalysis/MapSelectionModal";
import { FLOW_COLORS, HEADING_FONT, REDUCED_MOTION, fill, rise } from "./flowStyles";

// Entrance delays, in seconds: the stages one after another, each bar after the
// stage before it.
const STAGE_DELAYS = [0.05, 0.35, 0.65];
const BAR_DELAYS = [0.25, 0.55];

const StageDot: React.FC<{ stage: FlowStage; state: FlowStageView["state"] }> = ({
  stage,
  state,
}) => (
  <Box
    component="span"
    aria-hidden
    sx={{
      width: 38,
      height: 38,
      flex: "none",
      borderRadius: "50%",
      display: "grid",
      placeItems: "center",
      fontFamily: HEADING_FONT,
      fontWeight: 800,
      fontSize: 15,
      lineHeight: 1,
      border: "2px solid rgba(255, 255, 255, 0.35)",
      color: "rgba(255, 255, 255, 0.75)",
      ...(state === "done" && {
        backgroundColor: FLOW_COLORS.leaf,
        borderColor: FLOW_COLORS.leaf,
        color: FLOW_COLORS.leafInk,
      }),
      ...(state === "current" && {
        backgroundColor: FLOW_COLORS.white,
        borderColor: FLOW_COLORS.white,
        color: "primary.main",
        boxShadow: "0 0 0 6px rgba(255, 255, 255, 0.16)",
      }),
      ...(state === "skipped" && { borderStyle: "dashed" }),
      ...(state === "locked" && {
        borderColor: "rgba(255, 255, 255, 0.2)",
        color: "rgba(255, 255, 255, 0.45)",
      }),
    }}
  >
    {state === "done" ? <CheckRoundedIcon sx={{ fontSize: 20 }} /> : stage}
  </Box>
);

const ProgressBar: React.FC<{ value: number; delay: number }> = ({ value, delay }) => (
  <Box
    component="li"
    aria-hidden
    sx={{
      height: 3,
      marginX: 1.25,
      borderRadius: 3,
      backgroundColor: "rgba(255, 255, 255, 0.18)",
      overflow: "hidden",
      display: { xs: "none", md: "block" },
    }}
  >
    <Box
      sx={{
        height: "100%",
        width: `${value * 100}%`,
        backgroundColor: FLOW_COLORS.leaf,
        transformOrigin: "left",
        animation: `${fill} 0.5s ease ${delay}s both`,
        [REDUCED_MOTION]: { animation: "none" },
      }}
    />
  </Box>
);

/**
 * The flow's three stages, each with its state. Stages 1 and 2 can always be
 * opened; stage 3 only with analysis results (D5). Stage 2 goes to its page,
 * where the polygon subset and the layers are chosen; stage 3 without its choices
 * goes through the report layer modal, as the next-stage card does.
 */
export const FlowStepper: React.FC = () => {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { current, stages, progress, flags } = useFlowStages();
  const {
    reportGenerationParams: { selectedMaps: reportMaps, selectedFarms: reportFarms },
    territorialAnalysisParams: { selectedMaps: analysisMaps },
  } = useContext(DataContext);
  const [reportModalOpen, setReportModalOpen] = useState(false);

  const goToReport = useCallback(
    () => router.push(localizedPath(stageHref(3, flags), i18n.language)),
    [router, flags, i18n.language]
  );

  const openStage = useCallback(
    (stage: FlowStage) => {
      const action = stageAction(stage, current, {
        reportMapIds: reportMaps.map(({ id }) => id),
        analysisMapIds: analysisMaps.map(({ id }) => id),
        selectedFarmsCount: reportFarms.length,
      });
      if (action === "reportModal") setReportModalOpen(true);
      else if (action === "navigate")
        router.push(localizedPath(stageHref(stage, flags), i18n.language));
    },
    [current, flags, reportMaps, analysisMaps, reportFarms.length, router, i18n.language]
  );

  return (
    <>
      <Box component="nav" aria-label={t("flow:stepper.label")}>
        <Box
          component="ol"
          sx={{
            listStyle: "none",
            margin: 0,
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "auto 1fr auto 1fr auto" },
            alignItems: "center",
            gap: { xs: 0.75, md: 0 },
            padding: { xs: "12px 14px", md: "14px 22px" },
            backgroundColor: "rgba(255, 255, 255, 0.08)",
            border: "1px solid rgba(255, 255, 255, 0.14)",
            backdropFilter: "blur(6px)",
            borderRadius: 4,
          }}
        >
          {stages.map(({ stage, state, labelKey }, index) => {
            const content = (
              <>
                <StageDot stage={stage} state={state} />
                <Box component="span" sx={{ textAlign: "left" }}>
                  <Box
                    component="span"
                    sx={{
                      display: "block",
                      fontFamily: HEADING_FONT,
                      fontWeight: 700,
                      fontSize: 15,
                      lineHeight: 1.2,
                      opacity: state === "locked" ? 0.55 : 1,
                    }}
                  >
                    {t(`flow:stepper.stages.${stage}`)}
                  </Box>
                  <Box
                    component="span"
                    sx={{ display: "block", fontSize: 12, opacity: 0.7, marginTop: 0.25 }}
                  >
                    {t(`flow:${labelKey}`)}
                  </Box>
                </Box>
              </>
            );
            const itemSx = {
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              padding: "4px 8px",
              borderRadius: 2.5,
              color: FLOW_COLORS.white,
            };

            return (
              <Fragment key={stage}>
                {index > 0 && (
                  <ProgressBar value={progress[index - 1]} delay={BAR_DELAYS[index - 1]} />
                )}
                <Box
                  component="li"
                  sx={{
                    animation: `${rise} 0.45s ease ${STAGE_DELAYS[index]}s both`,
                    [REDUCED_MOTION]: { animation: "none" },
                  }}
                >
                  {/* The current stage is where the user is, and a locked stage 3
                      can't be opened: neither is a control. */}
                  {state === "locked" || state === "current" ? (
                    <Box
                      sx={itemSx}
                      aria-current={state === "current" ? "step" : undefined}
                    >
                      {content}
                    </Box>
                  ) : (
                    <ButtonBase
                      onClick={() => openStage(stage)}
                      sx={{
                        ...itemSx,
                        "&:hover, &.Mui-focusVisible": {
                          backgroundColor: "rgba(255, 255, 255, 0.07)",
                        },
                        "&.Mui-focusVisible": { outline: "2px solid rgba(255, 255, 255, 0.6)" },
                      }}
                    >
                      {content}
                    </ButtonBase>
                  )}
                </Box>
              </Fragment>
            );
          })}
        </Box>
      </Box>
      <MapSelectionModal
        isOpen={reportModalOpen}
        handleClose={() => setReportModalOpen(false)}
        handleContinue={() => {
          setReportModalOpen(false);
          goToReport();
        }}
      />
    </>
  );
};
