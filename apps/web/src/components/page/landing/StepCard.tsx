"use client";

import { Box, useTheme } from "@mui/material";
import type { SvgIconComponent } from "@mui/icons-material";
import Link from "next/link";
import { useTranslation } from "react-i18next";

export interface StepLink {
  label: string;
  href: string;
  // `download`: a file saved without leaving the page; `newTab`: opens beside it;
  // otherwise an in-app page.
  kind: "download" | "newTab" | "page";
}

interface StepCardProps {
  step: number;
  Icon: SvgIconComponent;
  title: string;
  description: string;
  link: StepLink;
  // Opens the step's stage. Without it the card can't be pressed.
  onOpen?: () => void;
  children?: React.ReactNode;
}

/**
 * One of the start page's three steps. A pressable card uses a "stretched" button
 * (its title) that covers the card, so the secondary link stays its own control.
 */
export const StepCard: React.FC<StepCardProps> = ({
  step,
  Icon,
  title,
  description,
  link,
  onOpen,
  children,
}) => {
  const { t } = useTranslation();
  const colors = useTheme().palette.landing;
  const linkSx = {
    position: "relative",
    zIndex: 1,
    alignSelf: "flex-start",
    marginTop: "auto",
    paddingTop: "10px",
    fontSize: 13,
    fontWeight: 500,
    color: colors.blue,
    textDecoration: "none",
    "&:hover": { textDecoration: "underline" },
  } as const;

  return (
    <Box
      component="article"
      data-testid={`step-${step}`}
      sx={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "common.white",
        border: `1px solid ${colors.line}`,
        borderRadius: "16px",
        padding: "18px 20px 16px",
        boxShadow: "0 18px 40px rgba(10,36,64,.14)",
        transition: "translate .18s, border-color .18s",
        ...(onOpen && {
          "&:hover": { translate: "0 -3px", borderColor: colors.mintStrong },
          "&:has(.step-open:focus-visible)": {
            outline: `3px solid ${colors.blue}`,
            outlineOffset: 2,
          },
        }),
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, marginBottom: 1 }}>
        <Box
          component="span"
          aria-hidden
          sx={{
            width: 30,
            height: 30,
            borderRadius: "50%",
            display: "grid",
            placeItems: "center",
            font: "800 14px/1 var(--font-heading)",
            backgroundColor: colors.forest,
            color: "common.white",
          }}
        >
          {step}
        </Box>
        <Box
          component="span"
          aria-hidden
          sx={{
            marginLeft: "auto",
            width: 38,
            height: 38,
            borderRadius: "10px",
            display: "grid",
            placeItems: "center",
            backgroundColor: colors.mint,
            color: colors.leaf,
          }}
        >
          <Icon sx={{ fontSize: 20 }} />
        </Box>
      </Box>
      <Box
        component="h3"
        sx={{
          margin: 0,
          fontFamily: "var(--font-heading)",
          fontSize: 18,
          fontWeight: 700,
          lineHeight: 1.15,
          letterSpacing: "-.015em",
          color: colors.ink,
        }}
      >
        <Box component="span" sx={visuallyHidden}>
          {t("home:landing:stepNumber", { step })}{" "}
        </Box>
        {onOpen ? (
          <Box
            component="button"
            type="button"
            className="step-open"
            onClick={onOpen}
            sx={{
              all: "unset",
              cursor: "pointer",
              "&::after": {
                content: '""',
                position: "absolute",
                inset: 0,
                borderRadius: "16px",
              },
            }}
          >
            {title}
          </Box>
        ) : (
          title
        )}
      </Box>
      <Box
        component="p"
        sx={{
          margin: "4px 0 0",
          fontSize: 14,
          lineHeight: 1.45,
          color: colors.inkSecondary,
        }}
      >
        {description}
      </Box>
      {children}
      {link.kind === "page" ? (
        <Box component={Link} href={link.href} sx={linkSx}>
          {link.label} <span aria-hidden>↗</span>
        </Box>
      ) : link.kind === "download" ? (
        <Box component="a" href={link.href} download sx={linkSx}>
          {link.label} <span aria-hidden>↓</span>
        </Box>
      ) : (
        <Box
          component="a"
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          sx={linkSx}
        >
          {link.label} <span aria-hidden>↗</span>
          <Box component="span" sx={visuallyHidden}>
            {" "}
            {t("home:landing:opensInNewTab")}
          </Box>
        </Box>
      )}
    </Box>
  );
};

// Read by screen readers only. Pinned to the card's corner, so it never overflows.
const visuallyHidden = {
  position: "absolute",
  top: 0,
  left: 0,
  margin: -1,
  width: 1,
  height: 1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
} as const;
