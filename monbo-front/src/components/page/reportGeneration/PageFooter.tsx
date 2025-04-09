"use client";

import { DevEnvWarning } from "@/components/reusable/DevEnvWarning";
import { Footer } from "@/components/reusable/Footer";
import { NavigationButton } from "@/components/reusable/NavigationButton";
import { Box } from "@mui/material";
import { useTranslation } from "react-i18next";

const namespaces = ["common", "deforestationAnalysis", "reportGeneration"];

export function PageFooter() {
  const { t } = useTranslation(namespaces);

  return (
    <Footer>
      <Box
        sx={{ width: "100%", display: "flex", justifyContent: "space-between" }}
      >
        <DevEnvWarning />
        <Box sx={{ display: "flex", gap: 2 }}>
          <NavigationButton
            label={t("reportGeneration:buttons:generateReport")}
            route="report-generation/preview"
          />
        </Box>
      </Box>
    </Footer>
  );
}
