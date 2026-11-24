"use client";

import { useCallback, useContext } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { AdminSessionContext } from "@/context/AdminSessionContext";
import { localizedPath } from "@/utils/languageChange";

/** Ends the admin session and opens the admin login, in the page's language. */
export const useAdminLogout = () => {
  const { i18n } = useTranslation();
  const router = useRouter();
  const { logout } = useContext(AdminSessionContext);

  return useCallback(() => {
    logout();
    router.replace(localizedPath("/admin", i18n.language));
  }, [logout, router, i18n.language]);
};
