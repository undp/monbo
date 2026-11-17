"use client";

import { Box, useTheme } from "@mui/material";
import Image from "next/image";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { useIsStartPage } from "@/hooks/useIsStartPage";
import { localizedPath } from "@/utils/languageChange";

/** The Monbo logo, which opens the start page, and the PNUD/UNDP mark. */
export const HeaderBrand: React.FC = () => {
  const { t, i18n } = useTranslation();
  const startPage = useIsStartPage();
  const colors = useTheme().palette.landing;

  return (
    <Box
      component={Link}
      href={localizedPath("/", i18n.language)}
      aria-label={t("common:header:logoLabel")}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.75,
        color: "inherit",
        textDecoration: "none",
        flex: "none",
      }}
    >
      <Image
        alt=""
        src={startPage ? "/images/Logo-white.svg" : "/images/Logo.svg"}
        height={32}
        width={148}
        priority
      />
      <Box
        component="span"
        aria-hidden
        sx={{ width: "1px", height: 28, backgroundColor: "currentColor", opacity: 0.2 }}
      />
      <Box
        component="span"
        aria-hidden
        sx={{
          font: "800 10px/1.05 var(--font-heading)",
          letterSpacing: ".08em",
          textAlign: "center",
          backgroundColor: colors.blue,
          color: "common.white",
          padding: "4px 5px",
          borderRadius: "2px",
        }}
      >
        {t("common:header:brandMarkTop")}
        <br />
        {t("common:header:brandMarkBottom")}
      </Box>
    </Box>
  );
};
