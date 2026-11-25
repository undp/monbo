import initTranslations from "@/utils/i18n";
import { Toolbar, Box } from "@mui/material";
import React, { Suspense } from "react";
import { HeaderBar } from "./HeaderBar";
import { HeaderBrand } from "./HeaderBrand";
import { HeaderNavigation } from "./HeaderNavigation";
import { MainNavigation } from "./MainNavigation";

import { LanguageMenu } from "../LanguageMenu";
import { CountryMenu } from "../CountryMenu";
import TranslationsProvider from "@/context/TranslationProvider";

interface HeaderProps {
  locale: string;
}

export const Header = async ({ locale }: HeaderProps) => {
  const { resources } = await initTranslations(locale, ["common"]);

  return (
    <TranslationsProvider
      locale={locale}
      namespaces={["common"]}
      resources={resources}
    >
      <HeaderBar>
        <Toolbar
          sx={{
            padding: "12px 16px",
            boxSizing: "border-box",
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: { xs: 1, md: 2 },
              width: "100%",
            }}
          >
            <HeaderBrand />
            <MainNavigation />
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 2,
                marginLeft: "auto",
              }}
            >
              <HeaderNavigation>
                <CountryMenu />
              </HeaderNavigation>
              <Suspense>
                <LanguageMenu />
              </Suspense>
            </Box>
          </Box>
        </Toolbar>
      </HeaderBar>
    </TranslationsProvider>
  );
};
