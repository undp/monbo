"use client";

import { useContext } from "react";
import { Box } from "@mui/material";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { AdminSessionContext } from "@/context/AdminSessionContext";
import { getCountryName } from "@/utils/countries";

const ADMIN_PATH = /^\/(?:[a-z]{2}\/)?admin(?:\/|$)/;

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
 * country). The admin pages show only the session's country instead.
 */
export const HeaderNavigation: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const pathname = usePathname();
  return ADMIN_PATH.test(pathname) ? <AdminCountry /> : <>{children}</>;
};
