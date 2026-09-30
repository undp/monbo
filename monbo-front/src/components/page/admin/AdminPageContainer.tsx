"use client";

import React, { useContext, useEffect } from "react";
import { Box, Button, CircularProgress } from "@mui/material";
import LogoutIcon from "@mui/icons-material/Logout";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { AdminSessionContext } from "@/context/AdminSessionContext";
import { Text } from "@/components/reusable/Text";
import { getCountryName } from "@/utils/countries";

interface Props {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

/** Layout for signed-in admin pages; sends visitors without a session to login.
 * Shows the country the session administers. */
export const AdminPageContainer: React.FC<Props> = ({
  title,
  subtitle,
  actions,
  children,
}) => {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { session, ready, logout } = useContext(AdminSessionContext);

  useEffect(() => {
    if (ready && !session) router.replace("/admin");
  }, [ready, session, router]);

  if (!ready || !session) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", padding: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1280, margin: "0 auto", padding: 3 }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 2,
          marginBottom: subtitle ? 1.5 : 3,
        }}
      >
        <Box>
          <Text color="secondary" variant="body2">
            {t("admin:title")}
          </Text>
          <Text variant="h3" component="h1" bold>
            {title} ·{" "}
            {getCountryName(session.country, i18n.language as "en" | "es") ??
              session.country}
          </Text>
        </Box>
        <Box sx={{ display: "flex", gap: 1, flexShrink: 0 }}>
          {actions}
          <Button
            startIcon={<LogoutIcon />}
            onClick={() => {
              logout();
              router.replace("/admin");
            }}
          >
            {t("admin:logout")}
          </Button>
        </Box>
      </Box>
      {subtitle && (
        // Below the title row, so it can use the page's full width.
        <Text color="secondary" variant="body2" sx={{ marginBottom: 3 }}>
          {subtitle}
        </Text>
      )}
      {children}
    </Box>
  );
};
