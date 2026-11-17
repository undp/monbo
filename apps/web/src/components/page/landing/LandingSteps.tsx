"use client";

import { memo } from "react";
import { Box, useTheme } from "@mui/material";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import LayersOutlinedIcon from "@mui/icons-material/LayersOutlined";
import ParkOutlinedIcon from "@mui/icons-material/ParkOutlined";
import PentagonOutlinedIcon from "@mui/icons-material/PentagonOutlined";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import SpaOutlinedIcon from "@mui/icons-material/SpaOutlined";
import { useTranslation } from "react-i18next";
import type { EntryStage } from "@/hooks/useStageEntry";
import { getUploadFileTemplatePath } from "@/utils/excel";
import { localizedPath } from "@/utils/languageChange";
import { StepArrow } from "./StepArrow";
import { StepCard } from "./StepCard";
import { entrance } from "./entrance";

// The generic categories a country can group its layers in (illustrative: they
// don't depend on the selected country).
// Their colors are in the theme (`palette.landing.categories`).
const CATEGORIES = [
  { key: "deforestation", Icon: ParkOutlinedIcon },
  { key: "protectedAreas", Icon: ShieldOutlinedIcon },
  { key: "agriculturalFrontier", Icon: SpaOutlinedIcon },
] as const;

// A sample report built from the example farms (see public/files/examples/README.md).
const SAMPLE_REPORT: Record<string, string> = {
  es: "/files/examples/es/ejemplo-reporte.pdf",
  en: "/files/examples/en/example-report.pdf",
};

interface LandingStepsProps {
  // Stable across renders, so changing the country doesn't re-render the steps.
  onOpenStage: (stage: EntryStage) => void;
}

/** "How it works": the three steps of the flow, each opening its stage. */
export const LandingSteps: React.FC<LandingStepsProps> = memo(function LandingSteps({
  onOpenStage,
}) {
  const { t, i18n } = useTranslation();
  const colors = useTheme().palette.landing;
  const locale = i18n.language;

  return (
    <Box component="section" aria-labelledby="landing-steps-title">
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "baseline",
          columnGap: 1.75,
          rowGap: 0.5,
          marginBottom: 1.5,
          color: { xs: colors.ink, md: "common.white" },
        }}
      >
        <Box
          component="h2"
          id="landing-steps-title"
          sx={{
            margin: 0,
            fontFamily: "var(--font-heading)",
            fontSize: 17,
            fontWeight: 700,
            letterSpacing: "-.015em",
          }}
        >
          {t("home:landing:stepsTitle")}
        </Box>
        <Box component="p" sx={{ margin: 0, fontSize: 13, opacity: 0.75 }}>
          {t("home:landing:stepsSubtitle")}
        </Box>
      </Box>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr auto 1fr auto 1fr" },
          alignItems: "stretch",
          "& > article": entrance(0),
          "& > article:nth-of-type(1)": { animationDelay: ".1s" },
          "& > article:nth-of-type(2)": { animationDelay: ".35s" },
          "& > article:nth-of-type(3)": { animationDelay: ".6s" },
        }}
      >
        <StepCard
          step={1}
          Icon={PentagonOutlinedIcon}
          title={t("home:landing:steps:validation:title")}
          description={t("home:landing:steps:validation:description")}
          link={{
            label: t("home:landing:steps:validation:link"),
            href: getUploadFileTemplatePath(locale),
            kind: "download",
          }}
          onOpen={() => onOpenStage(1)}
        />
        <StepArrow delay={0.28} />
        <StepCard
          step={2}
          Icon={LayersOutlinedIcon}
          title={t("home:landing:steps:analysis:title")}
          description={t("home:landing:steps:analysis:description")}
          link={{
            label: t("home:landing:steps:analysis:link"),
            href: localizedPath("/documentation#layers", locale),
            kind: "page",
          }}
          onOpen={() => onOpenStage(2)}
        >
          <Box
            component="ul"
            sx={{
              display: "flex",
              flexWrap: "wrap",
              gap: "6px",
              listStyle: "none",
              margin: "10px 0 0",
              padding: 0,
            }}
          >
            {CATEGORIES.map(({ key, Icon }) => {
              const { main, tint } = colors.categories[key];
              return (
                <Box
                  component="li"
                  key={key}
                  sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "4px 10px 4px 6px",
                    borderRadius: 999,
                    fontSize: 12.5,
                    fontWeight: 500,
                    backgroundColor: tint,
                    color: main,
                  }}
                >
                  <Box
                    component="span"
                    aria-hidden
                    sx={{
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      display: "grid",
                      placeItems: "center",
                      backgroundColor: main,
                      color: "common.white",
                    }}
                  >
                    <Icon sx={{ fontSize: 13 }} />
                  </Box>
                  {t(`home:landing:categories:${key}`)}
                </Box>
              );
            })}
          </Box>
        </StepCard>
        <StepArrow delay={0.53} />
        <StepCard
          step={3}
          Icon={DescriptionOutlinedIcon}
          title={t("home:landing:steps:report:title")}
          description={t("home:landing:steps:report:description")}
          link={{
            label: t("home:landing:steps:report:link"),
            href: SAMPLE_REPORT[locale] ?? SAMPLE_REPORT.es,
            kind: "newTab",
          }}
        />
      </Box>
    </Box>
  );
});
