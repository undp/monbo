"use client";

import React, { useContext, useEffect } from "react";
import { Box, CircularProgress } from "@mui/material";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { stagePageBackground } from "@/components/page/flow/flowStyles";
import { AdminSessionContext } from "@/context/AdminSessionContext";
import { localizedPath } from "@/utils/languageChange";
import { AdminSidebar } from "./AdminSidebar";

/**
 * The signed-in admin pages' frame: sends visitors without a session to the login,
 * and shows the sidebar beside the page on the stage pages' background.
 */
export const AdminShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { i18n } = useTranslation();
  const router = useRouter();
  const { session, ready } = useContext(AdminSessionContext);

  useEffect(() => {
    if (ready && !session) router.replace(localizedPath("/admin", i18n.language));
  }, [ready, session, router, i18n.language]);

  if (!ready || !session) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", padding: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", alignItems: "flex-start", background: stagePageBackground }}>
      <AdminSidebar />
      <Box sx={{ flex: 1, minWidth: 0 }}>{children}</Box>
    </Box>
  );
};
