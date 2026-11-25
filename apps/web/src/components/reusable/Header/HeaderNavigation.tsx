"use client";

import { usePathname } from "next/navigation";
import { isAdminPath } from "@/utils/paths";

/**
 * The header's navigation (`children`: the analysis country). The admin pages show
 * none: their sidebar holds the sections and the session's country, which is fixed.
 */
export const HeaderNavigation: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const pathname = usePathname();
  return isAdminPath(pathname) ? null : <>{children}</>;
};
