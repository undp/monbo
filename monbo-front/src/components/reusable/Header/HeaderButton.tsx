"use client";

import { useModuleRouter } from "@/hooks/useModuleRouter";
import { Button } from "@mui/material";
import { usePathname } from "next/navigation";
import { useContext, useMemo } from "react";
import { DataContext } from "@/context/DataContext";
import { useTranslation } from "react-i18next";

interface HeaderButtonProps {
  children: React.ReactNode;
  path?: string;
}

export const HeaderButton: React.FC<HeaderButtonProps> = ({
  children,
  path,
}) => {
  const goToModule = useModuleRouter(path);
  const pathname = usePathname();
  const { i18n } = useTranslation();

  const isHomepage = useMemo(
    () => pathname === "/" || pathname === `/${i18n.language}`,
    [pathname, i18n.language]
  );

  const { polygonsValidationResults, deforestationAnalysisResults } =
    useContext(DataContext);

  const isPathActive = path
    ? isHomepage
      ? pathname === path
      : pathname.includes(path)
    : false;

  const isDisabled =
    !isPathActive &&
    (!path ||
      (path.includes("polygons-validation") && !polygonsValidationResults) ||
      (path.includes("deforestation-analysis") &&
        !deforestationAnalysisResults) ||
      path.includes("report-generation"));

  return (
    <Button
      disabled={isDisabled}
      sx={{
        display: isHomepage ? "none" : "block",
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
