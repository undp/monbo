"use client";

import { Popover, Box, Select, MenuItem, IconButton } from "@mui/material";
import { useCallback, useState } from "react";
import LanguageIcon from "@mui/icons-material/Language";
import { Text } from "@/components/reusable/Text";
import { useTranslation } from "react-i18next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import i18nConfig from "@/i18nConfig";
import { localizedPath, startLanguageChange } from "@/utils/languageChange";

const languages = [
  { name: "common:language:es", locale: "es" },
  { name: "common:language:en", locale: "en" },
];

export const LanguageMenu: React.FC = ({}) => {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const currentPathname = usePathname();
  const searchParams = useSearchParams();
  const currentLocale = i18n.language;
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };

  const open = Boolean(anchorEl);

  const handleChangeLanguage = useCallback(
    (locale: string) => {
      // set cookie for next-i18n-router
      const days = 30;
      const date = new Date();
      date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
      const expires = date.toUTCString();
      document.cookie = `NEXT_LOCALE=${locale};expires=${expires};path=/`;

      // Pages remount in the new language; this lets them keep unsaved input.
      startLanguageChange();

      // Redirect to the same page in the new locale. The path may carry a locale
      // prefix, even the default one (e.g. /es/admin): strip whichever it has.
      const [, first, ...rest] = currentPathname.split("/");
      const path = i18nConfig.locales.includes(first)
        ? `/${rest.join("/")}`
        : currentPathname;
      router.push(`${localizedPath(path, locale)}?${searchParams.toString()}`);

      router.refresh();
      handleClose();
    },
    [currentPathname, router, searchParams]
  );

  return (
    <>
      <IconButton sx={{ color: "#3A3541" }} onClick={handleOpen}>
        <LanguageIcon />
      </IconButton>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "right",
        }}
      >
        <Box
          sx={{ padding: 2, display: "flex", flexDirection: "column", gap: 1 }}
        >
          <Text variant="h4" bold>
            {t("common:language:select")}
          </Text>
          <Select
            value={currentLocale}
            onChange={(e) => handleChangeLanguage(e.target.value as string)}
            sx={{ width: 141 }}
            margin="dense"
          >
            {languages.map((language) => (
              <MenuItem key={language.locale} value={language.locale}>
                {t(language.name)}
              </MenuItem>
            ))}
          </Select>
        </Box>
      </Popover>
    </>
  );
};
