import { DevEnvWarning } from "@/components/reusable/DevEnvWarning";
import { Footer } from "@/components/reusable/Footer";
import initTranslations from "@/utils/i18n";
import { Box } from "@mui/material";
import { NavigationButton } from "@/components/reusable/NavigationButton";

const namespaces = ["common", "deforestationAnalysis"];

export async function PageFooter({ locale }: { locale: string }) {
  const { t } = await initTranslations(locale, namespaces);
  return (
    <Footer>
      <Box
        sx={{ width: "100%", display: "flex", justifyContent: "space-between" }}
      >
        <DevEnvWarning />
        <Box sx={{ display: "flex", gap: 2 }}>
          <NavigationButton
            label={t("deforestationAnalysis:buttons:createReport")}
            route="/report-generation"
          />
        </Box>
      </Box>
    </Footer>
  );
}
