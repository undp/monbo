"use client";

import { IconButton, Tooltip } from "@mui/material";
import MenuBookOutlinedIcon from "@mui/icons-material/MenuBookOutlined";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { isSamePath } from "@/utils/paths";
import { localizedPath } from "@/utils/languageChange";

const DOCUMENTATION_PATH = "/documentation";

/**
 * Opens the documentation page. Beside the language selector, outside the module
 * navigation, so it shows on every page (the landing and the admin pages too).
 */
export const DocumentationButton: React.FC = () => {
  const { t, i18n } = useTranslation();
  const pathname = usePathname();
  const label = t("common:header:documentation");
  const isActive = isSamePath(pathname, DOCUMENTATION_PATH, i18n.language);

  return (
    <Tooltip title={label}>
      <IconButton
        component={Link}
        href={localizedPath(DOCUMENTATION_PATH, i18n.language)}
        aria-label={label}
        aria-current={isActive ? "page" : undefined}
        sx={{
          color: "#3A3541",
          ...(isActive ? { color: "#03689E", backgroundColor: "#F3FAFD" } : {}),
        }}
      >
        <MenuBookOutlinedIcon />
      </IconButton>
    </Tooltip>
  );
};
