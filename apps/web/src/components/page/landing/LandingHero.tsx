"use client";

import { memo } from "react";
import { Box, useTheme } from "@mui/material";
import LockOpenOutlinedIcon from "@mui/icons-material/LockOpenOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import PersonOutlineOutlinedIcon from "@mui/icons-material/PersonOutlineOutlined";
import Link from "next/link";
import { Trans, useTranslation } from "react-i18next";
import { DevEnvWarning } from "@/components/reusable/DevEnvWarning";
import { SHOW_TESTING_ENVIRONMENT_WARNING } from "@/config/env";
import { localizedPath } from "@/utils/languageChange";

// AI-generated aerial view: forest, a river and farm plots. Decorative.
const HERO_IMAGE = "/images/landing/aerial-forest-river-farm-plots.webp";

const BADGES = [
  { key: "free", Icon: LockOpenOutlinedIcon, highlighted: true },
  { key: "noSignUp", Icon: PersonOutlineOutlinedIcon, highlighted: false },
  { key: "noStorage", Icon: LockOutlinedIcon, highlighted: false },
] as const;

/** The start page's hero: free-access badges, the title and the lead. */
export const LandingHero: React.FC = memo(function LandingHero() {
  const { t, i18n } = useTranslation();
  const colors = useTheme().palette.landing;

  return (
    <Box
      component="section"
      aria-labelledby="landing-title"
      sx={{
        position: "relative",
        overflow: "hidden",
        color: "#fff",
        // The header (64 px) is drawn over the hero.
        padding: { xs: "88px 0 40px", md: "84px 0 112px" },
        background: `linear-gradient(105deg, ${colors.navy} 0%, ${colors.navyForest} 45%, ${colors.forest} 100%)`,
      }}
    >
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          inset: { xs: 0, md: "0 0 0 46%" },
          opacity: { xs: 0.35, md: 1 },
          background: `url(${HERO_IMAGE}) 62% 50% / cover no-repeat`,
          WebkitMaskImage: "linear-gradient(90deg, transparent 0, #000 34%)",
          maskImage: "linear-gradient(90deg, transparent 0, #000 34%)",
          "&::after": {
            content: '""',
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, rgba(10,36,64,.35), rgba(14,59,48,.15) 40%, rgba(14,59,48,.75))",
          },
        }}
      />
      {SHOW_TESTING_ENVIRONMENT_WARNING && (
        <Box
          sx={{
            position: { xs: "relative", md: "absolute" },
            top: { md: 76 },
            right: { md: 24 },
            zIndex: 2,
            padding: { xs: "0 16px 12px", md: 0 },
            // Wraps on narrow screens instead of overflowing.
            "& > div": { width: { xs: "auto", md: "max-content" } },
          }}
        >
          <DevEnvWarning />
        </Box>
      )}
      <Box
        sx={{
          position: "relative",
          zIndex: 1,
          maxWidth: 1280,
          margin: "0 auto",
          padding: { xs: "0 16px", md: "0 28px" },
        }}
      >
        <Box sx={{ maxWidth: 700 }}>
          <Box
            component="ul"
            sx={{
              display: "flex",
              flexWrap: "wrap",
              gap: 1,
              listStyle: "none",
              margin: "0 0 12px",
              padding: 0,
            }}
          >
            {BADGES.map(({ key, Icon, highlighted }) => (
              <Box
                component="li"
                key={key}
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "7px",
                  padding: "6px 12px",
                  borderRadius: 999,
                  fontSize: 13,
                  lineHeight: 1.3,
                  ...(highlighted
                    ? {
                        backgroundColor: colors.leafLight,
                        border: `1px solid ${colors.leafLight}`,
                        color: colors.onLeafLight,
                        fontWeight: 700,
                      }
                    : {
                        backgroundColor: "rgba(255,255,255,.1)",
                        border: "1px solid rgba(255,255,255,.18)",
                        fontWeight: 500,
                      }),
                }}
              >
                <Icon aria-hidden sx={{ fontSize: 16 }} />
                {t(`home:landing:badges:${key}`)}
              </Box>
            ))}
          </Box>
          <Box
            component="p"
            sx={{
              margin: 0,
              font: "700 12px/1 var(--font-roboto)",
              letterSpacing: ".16em",
              textTransform: "uppercase",
              color: colors.eyebrow,
            }}
          >
            {t("home:landing:eyebrow")}
          </Box>
          <Box
            component="h1"
            id="landing-title"
            sx={{
              fontFamily: "var(--font-heading)",
              fontSize: { xs: 34, md: 42 },
              fontWeight: 800,
              lineHeight: 1.15,
              letterSpacing: "-.015em",
              margin: "8px 0",
              "& em": { fontStyle: "normal", color: colors.leafLight },
            }}
          >
            <Trans
              i18nKey="home:landing:title"
              components={{ highlight: <em /> }}
            />
          </Box>
          <Box
            component="p"
            sx={{
              margin: 0,
              fontSize: 18,
              lineHeight: 1.5,
              color: "rgba(255,255,255,.82)",
              maxWidth: 540,
            }}
          >
            {t("home:landing:lead")}{" "}
            <Box
              component={Link}
              href={localizedPath("/documentation", i18n.language)}
              sx={{
                color: "#fff",
                fontWeight: 600,
                fontSize: 16,
                whiteSpace: "nowrap",
                marginLeft: "6px",
                textDecoration: "underline",
                textUnderlineOffset: 4,
                textDecorationColor: "rgba(255,255,255,.4)",
              }}
            >
              {t("home:landing:howItWorks")} <span aria-hidden>↗</span>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
});
