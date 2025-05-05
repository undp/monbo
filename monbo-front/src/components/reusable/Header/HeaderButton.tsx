"use client";

import { useModuleRouter } from "@/hooks/useModuleRouter";
import { Button } from "@mui/material";
import { usePathname } from "next/navigation";
import { useContext, useMemo } from "react";
import { DataContext } from "@/context/DataContext";
import { useTranslation } from "react-i18next";

interface HeaderButtonProps {
  children: React.ReactNode;
  path: string;
}

export const HeaderButton: React.FC<HeaderButtonProps> = ({
  children,
  path,
}) => {
  const goToModule = useModuleRouter(path);
  const pathname = usePathname();
  const { i18n } = useTranslation();

  const { polygonsValidationResults, deforestationAnalysisResults } =
    useContext(DataContext);

  const currentPathnameIsHomepage = useMemo(
    () => pathname === "/" || pathname === `/${i18n.language}`,
    [pathname, i18n.language]
  );

  const isPathActive = useMemo(
    () => pathname === path || pathname === `/${i18n.language}${path}`,
    [pathname, path, i18n.language]
  );

  const isDisabled =
    !isPathActive &&
    (!path ||
      (path.includes("polygons-validation") && !polygonsValidationResults) ||
      (path.includes("deforestation-analysis") &&
        !deforestationAnalysisResults) ||
      path.includes("report-generation"));

  if (currentPathnameIsHomepage) return null;

  return (
    <Button
      disabled={isDisabled}
      sx={{
        color: "#3A3541",
        ...(isPathActive
          ? { color: "#03689E", backgroundColor: "#F3FAFD" }
          : {}),
      }}
      onClick={goToModule}
    >
      {children}
    </Button>
  );
};
