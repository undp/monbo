"use client";

import React, { useContext } from "react";
import { Box, ButtonBase } from "@mui/material";
import LogoutIcon from "@mui/icons-material/Logout";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { FLOW_COLORS, HEADING_FONT } from "@/components/page/flow/flowStyles";
import { ADMIN_SECTIONS, isInAdminSection } from "@/components/reusable/Header/adminSections";
import { AdminSessionContext } from "@/context/AdminSessionContext";
import { useAdminLogout } from "@/hooks/useAdminLogout";
import { getCountryName } from "@/utils/countries";
import { localizedPath } from "@/utils/languageChange";

/** The app header's height from 900 px, which the sidebar stays under. */
export const ADMIN_HEADER_HEIGHT = 64;
export const ADMIN_SIDEBAR_WIDTH = 264;

const ITEM = {
  display: "flex",
  alignItems: "center",
  gap: 1.5,
  width: "100%",
  padding: "10px 14px",
  borderRadius: "10px",
  fontSize: 15,
  fontWeight: 500,
  color: FLOW_COLORS.ink,
  textDecoration: "none",
  justifyContent: "flex-start",
  "&:hover": { backgroundColor: FLOW_COLORS.blue25 },
  "&:focus-visible": { outline: `2px solid ${FLOW_COLORS.blue}`, outlineOffset: 2 },
} as const;

/**
 * The admin's left sidebar (mockup v2): the session's country, the sections with
 * the current one marked, and "Log out" at the bottom. Hidden below 900 px, where
 * the header's menu holds the same.
 */
export const AdminSidebar: React.FC = () => {
  const { t, i18n } = useTranslation();
  const pathname = usePathname();
  const { session } = useContext(AdminSessionContext);
  const logout = useAdminLogout();
  if (!session) return null;

  const country =
    getCountryName(session.country, i18n.language as "en" | "es") ?? session.country;

  return (
    <Box
      component="aside"
      sx={{
        display: { xs: "none", md: "flex" },
        flexDirection: "column",
        gap: 3,
        flex: "none",
        width: ADMIN_SIDEBAR_WIDTH,
        boxSizing: "border-box",
        padding: "24px 16px",
        position: "sticky",
        top: ADMIN_HEADER_HEIGHT,
        height: `calc(100vh - ${ADMIN_HEADER_HEIGHT}px)`,
        backgroundColor: FLOW_COLORS.white,
        borderRight: `1px solid ${FLOW_COLORS.line}`,
      }}
    >
      <Box
        sx={{
          padding: "14px 16px",
          borderRadius: "12px",
          backgroundColor: FLOW_COLORS.mint,
          color: FLOW_COLORS.ink,
        }}
      >
        <Box component="span" sx={{ display: "block", fontSize: 14, color: FLOW_COLORS.ink2 }}>
          {t("common:header:admin:session")}
        </Box>
        <Box
          component="span"
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            marginTop: 0.5,
            fontFamily: HEADING_FONT,
            fontSize: 17,
            fontWeight: 700,
          }}
        >
          <PlaceOutlinedIcon fontSize="small" sx={{ color: FLOW_COLORS.leafDark }} aria-hidden />
          {country}
        </Box>
      </Box>

      <Box
        component="nav"
        aria-label={t("common:header:admin:navigation")}
        sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}
      >
        {ADMIN_SECTIONS.map(({ path, label, Icon }) => {
          const current = isInAdminSection(pathname, path);
          return (
            <Box
              key={path}
              component={Link}
              href={localizedPath(path, i18n.language)}
              aria-current={current ? "page" : undefined}
              sx={{
                ...ITEM,
                ...(current && {
                  color: FLOW_COLORS.blue,
                  backgroundColor: FLOW_COLORS.blue50,
                  "&:hover": { backgroundColor: FLOW_COLORS.blue50 },
                }),
              }}
            >
              <Icon fontSize="small" aria-hidden />
              {t(label)}
            </Box>
          );
        })}
      </Box>

      <ButtonBase onClick={logout} sx={{ ...ITEM, marginTop: "auto", fontFamily: "inherit" }}>
        <LogoutIcon fontSize="small" aria-hidden />
        {t("common:header:admin:logout")}
      </ButtonBase>
    </Box>
  );
};
