import initTranslations from "@/utils/i18n";
import { AppBar, Toolbar, Box } from "@mui/material";
import Image from "next/image";
import Link from "next/link";
import React, { Suspense } from "react";
import { HeaderButton } from "./HeaderButton";

import { LanguageMenu } from "../LanguageMenu";
import TranslationsProvider from "@/context/TranslationProvider";

interface HeaderProps {
  locale: string;
}

export const Header = async ({ locale }: HeaderProps) => {
  const { t, resources } = await initTranslations(locale, ["common"]);

  return (
    <TranslationsProvider
      locale={locale}
      namespaces={["common"]}
      resources={resources}
    >
      <AppBar
        position="fixed"
        sx={{
          backgroundColor: "white",
          color: "#3A3541",
        }}
      >
        <Toolbar
          sx={{
            padding: "12px 16px",
            boxSizing: "border-box",
          }}
        >
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              width: "100%",
            }}
          >
            <Link href="/" style={{ height: 40 }}>
              <Image
                alt="logo"
                src="/images/Logo.svg"
                height={40}
                width={188}
              />
            </Link>
            <Box sx={{ display: "flex", gap: 2 }}>
              <HeaderButton path="/">{t("home:header:home")}</HeaderButton>
              <HeaderButton path="/polygons-validation">
                {t("home:header:validation")}
              </HeaderButton>
              <HeaderButton path="/deforestation-analysis">
                {t("home:header:deforestation")}
              </HeaderButton>
              <HeaderButton path="/report-generation">
                {t("home:header:report")}
              </HeaderButton>
              <Suspense>
                <LanguageMenu />
              </Suspense>
            </Box>
          </Box>
        </Toolbar>
      </AppBar>
    </TranslationsProvider>
  );
};
