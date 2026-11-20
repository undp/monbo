"use client";

import { useCallback, useEffect, useRef } from "react";
import { Box, useTheme } from "@mui/material";
import { ActionModal } from "@/components/reusable/Modals/ActionModal";
import { useStageEntry, type EntryStage } from "@/hooks/useStageEntry";
import { LandingHero } from "./LandingHero";
import { LandingStart } from "./LandingStart";
import { LandingSteps } from "./LandingSteps";
import { LandingTrust } from "./LandingTrust";

/**
 * The start page: hero, the three steps, the start bar and the trust row. Changing
 * the country re-renders only the start bar: the steps get callbacks that never
 * change, so they neither render nor animate again.
 */
export const LandingPageContent: React.FC = () => {
  const colors = useTheme().palette.landing;
  const validation = useStageEntry(1);
  const analysis = useStageEntry(2);

  // `enter` changes with the loaded farms; the steps call the latest one.
  const enterStage = useRef({ 1: validation.enter, 2: analysis.enter });
  useEffect(() => {
    enterStage.current = { 1: validation.enter, 2: analysis.enter };
  }, [validation.enter, analysis.enter]);

  const openStage = useCallback(
    (stage: EntryStage) => enterStage.current[stage](),
    []
  );
  const start = useCallback(() => enterStage.current[1](), []);

  return (
    <Box sx={{ minHeight: "100svh", backgroundColor: colors.background, color: colors.ink }}>
      <LandingHero />
      <Box
        sx={{
          position: "relative",
          zIndex: 2,
          maxWidth: 1280,
          margin: { xs: "0 auto", md: "-92px auto 0" },
          padding: { xs: "20px 16px 24px", md: "0 28px" },
        }}
      >
        <LandingSteps onOpenStage={openStage} />
        <LandingStart onStart={start} />
      </Box>
      <LandingTrust />
      <ActionModal {...validation.modal} />
      <ActionModal {...analysis.modal} />
    </Box>
  );
};
