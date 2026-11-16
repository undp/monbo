"use client";

import { useContext, useState } from "react";
import { Box, IconButton, Menu, MenuItem, useTheme } from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { DataContext } from "@/context/DataContext";
import { useIsStartPage } from "@/hooks/useIsStartPage";
import { localizedPath } from "@/utils/languageChange";
import { isSamePath } from "@/utils/paths";

const ADMIN_PATH = /^\/(?:[a-z]{2}\/)?admin(?:\/|$)/;
const FLOW_PATH =
  /^\/(?:[a-z]{2}\/)?(?:polygons-validation|deforestation-analysis|report-generation)(?:\/|$)/;
const DOCUMENTATION_PATH = "/documentation";

interface NavLink {
  key: string;
  label: string;
  href: string;
  current: boolean;
}

/**
 * "Analysis" resumes the flow: the analysis once it has results, the validation once
 * it has results, else stage 1's upload page.
 */
const useAnalysisPath = () => {
  const { polygonsValidationResults, deforestationAnalysisResults } =
    useContext(DataContext);
  if (deforestationAnalysisResults) return "/deforestation-analysis";
  if (polygonsValidationResults) return "/polygons-validation";
  return "/polygons-validation/upload-data";
};

/**
 * The header's main links: Home, Analysis and Methodology. The admin pages show
 * their own sections instead of the first two. Below 900 px the links move into a
 * menu.
 */
export const MainNavigation: React.FC = () => {
  const { t, i18n } = useTranslation();
  const pathname = usePathname();
  const startPage = useIsStartPage();
  const colors = useTheme().palette.landing;
  const analysisPath = useAnalysisPath();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const locale = i18n.language;

  const links: NavLink[] = [
    ...(ADMIN_PATH.test(pathname)
      ? []
      : [
          {
            key: "home",
            label: t("common:header:home"),
            href: localizedPath("/", locale),
            current: startPage,
          },
          {
            key: "analysis",
            label: t("common:header:analysis"),
            href: localizedPath(analysisPath, locale),
            current: FLOW_PATH.test(pathname),
          },
        ]),
    {
      key: "methodology",
      label: t("common:header:methodology"),
      href: localizedPath(DOCUMENTATION_PATH, locale),
      current: isSamePath(pathname, DOCUMENTATION_PATH, locale),
    },
  ];

  return (
    <>
      <Box
        component="nav"
        aria-label={t("common:header:navigation")}
        sx={{ display: { xs: "none", md: "flex" }, gap: 0.5, marginLeft: 1.5 }}
      >
        {links.map(({ key, label, href, current }) => (
          <Box
            key={key}
            component={Link}
            href={href}
            aria-current={current ? "page" : undefined}
            sx={{
              color: "inherit",
              opacity: current ? 1 : 0.75,
              padding: "8px 12px",
              borderRadius: "8px",
              fontWeight: 500,
              fontSize: 14,
              textDecoration: "none",
              transition: "opacity .15s, background-color .15s",
              "&:hover": { opacity: 1, backgroundColor: "rgba(127,160,190,.12)" },
              "&:focus-visible": {
                outline: "2px solid currentColor",
                outlineOffset: 2,
              },
              ...(current &&
                (startPage
                  ? { backgroundColor: "rgba(255,255,255,.12)" }
                  : { color: colors.blue, backgroundColor: colors.blueTint })),
            }}
          >
            {label}
          </Box>
        ))}
      </Box>
      <Box sx={{ display: { xs: "flex", md: "none" } }}>
        <IconButton
          aria-label={t("common:header:menu")}
          aria-haspopup="menu"
          sx={{ color: "inherit" }}
          onClick={(event) => setAnchorEl(event.currentTarget)}
        >
          <MenuIcon />
        </IconButton>
        <Menu
          anchorEl={anchorEl}
          open={!!anchorEl}
          onClose={() => setAnchorEl(null)}
        >
          {links.map(({ key, label, href, current }) => (
            <MenuItem
              key={key}
              component={Link}
              href={href}
              selected={current}
              aria-current={current ? "page" : undefined}
              onClick={() => setAnchorEl(null)}
            >
              {label}
            </MenuItem>
          ))}
        </Menu>
      </Box>
    </>
  );
};
