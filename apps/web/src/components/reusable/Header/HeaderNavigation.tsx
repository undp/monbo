"use client";

import { useContext } from "react";
import { Box, Button } from "@mui/material";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import { usePathname, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { AdminSessionContext } from "@/context/AdminSessionContext";
import { getCountryName } from "@/utils/countries";
import { localizedPath } from "@/utils/languageChange";
import { isAdminPath } from "@/utils/paths";
import { ADMIN_SECTIONS, isInAdminSection } from "./adminSections";

/** The admin sections, once logged in, with the current one marked. */
const AdminNavigation: React.FC = () => {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const { session } = useContext(AdminSessionContext);
  if (!session) return null;

  return (
    <Box component="nav" aria-label={t("common:header:admin:navigation")} sx={{ display: "flex", gap: 1 }}>
      {ADMIN_SECTIONS.map(({ path, label }) => {
        const current = isInAdminSection(pathname, path);
        return (
          <Button
            key={path}
            aria-current={current ? "page" : undefined}
            sx={{
              color: "#3A3541",
              ...(current ? { color: "#03689E", backgroundColor: "#F3FAFD" } : {}),
            }}
            onClick={() => router.push(localizedPath(path, i18n.language))}
          >
            {t(label)}
          </Button>
        );
      })}
    </Box>
  );
};

/** The country the admin session administers: information, not a selector. */
const AdminCountry: React.FC = () => {
  const { i18n } = useTranslation();
  const { session } = useContext(AdminSessionContext);
  if (!session) return null;

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        paddingX: 1,
        typography: "button",
        color: "#3A3541",
      }}
    >
      <PlaceOutlinedIcon fontSize="small" />
      {getCountryName(session.country, i18n.language as "en" | "es") ??
        session.country}
    </Box>
  );
};

/**
 * The header's navigation (`children`: the module buttons and the analysis
 * country). The admin pages show their own sections and the session's country
 * instead.
 */
export const HeaderNavigation: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const pathname = usePathname();
  return isAdminPath(pathname) ? (
    // Below 900 px the sections and the country move into the header's menu.
    <Box sx={{ display: { xs: "none", md: "flex" }, alignItems: "center", gap: 2 }}>
      <AdminNavigation />
      <AdminCountry />
    </Box>
  ) : (
    <>{children}</>
  );
};
