"use client";

import { useContext, useState } from "react";
import {
  Box,
  IconButton,
  ListSubheader,
  Menu,
  MenuItem,
  useTheme,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { AdminSessionContext } from "@/context/AdminSessionContext";
import { DataContext } from "@/context/DataContext";
import { useAdminLogout } from "@/hooks/useAdminLogout";
import { useIsStartPage } from "@/hooks/useIsStartPage";
import { localizedPath } from "@/utils/languageChange";
import { getCountryName } from "@/utils/countries";
import { isAdminPath, isSamePath } from "@/utils/paths";
import { ADMIN_SECTIONS, isInAdminSection } from "./adminSections";

const FLOW_PATH =
  /^\/(?:[a-z]{2}\/)?(?:polygons-validation|territorial-analysis|report-generation)(?:\/|$)/;
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
  const { polygonsValidationResults, territorialAnalysisResults } =
    useContext(DataContext);
  if (territorialAnalysisResults) return "/territorial-analysis";
  if (polygonsValidationResults) return "/polygons-validation";
  return "/polygons-validation/upload-data";
};

/**
 * The header's main links: Home, Analysis and Methodology. The admin pages show
 * only Methodology: their sidebar holds the sections. Below 900 px the links move
 * into a menu, which on the admin pages also holds the admin's country, sections
 * and "Log out", since the sidebar is hidden there.
 */
export const MainNavigation: React.FC = () => {
  const { t, i18n } = useTranslation();
  const pathname = usePathname();
  const startPage = useIsStartPage();
  const colors = useTheme().palette.landing;
  const analysisPath = useAnalysisPath();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const locale = i18n.language;
  const { session } = useContext(AdminSessionContext);
  const logout = useAdminLogout();
  // Logged in to the admin: its sections, in the menu only (the sidebar shows them
  // from 900 px, AdminSidebar).
  const adminLinks: NavLink[] =
    isAdminPath(pathname) && session
      ? ADMIN_SECTIONS.map(({ path, label }) => ({
          key: path,
          label: t(label),
          href: localizedPath(path, locale),
          current: isInAdminSection(pathname, path),
        }))
      : [];

  const links: NavLink[] = [
    ...(isAdminPath(pathname)
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
          {session && adminLinks.length > 0 && (
            <ListSubheader>
              {getCountryName(session.country, locale as "en" | "es") ?? session.country}
            </ListSubheader>
          )}
          {[...adminLinks, ...links].map(({ key, label, href, current }) => (
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
          {session && adminLinks.length > 0 && (
            <MenuItem
              onClick={() => {
                setAnchorEl(null);
                logout();
              }}
            >
              {t("common:header:admin:logout")}
            </MenuItem>
          )}
        </Menu>
      </Box>
    </>
  );
};
