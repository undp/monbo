import { DevEnvWarning } from "@/components/reusable/DevEnvWarning";
import { Footer } from "@/components/reusable/Footer";
import { NavigationButton } from "@/components/reusable/NavigationButton";
import initTranslations from "@/utils/i18n";
import { Box, Button } from "@mui/material";

const namespaces = ["common", "deforestationAnalysis", "reportGeneration"];

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
            label={t("reportGeneration:buttons:preview")}
            route="report-generation/preview"
          />
          <Button variant="contained" color="primary">
            {t("reportGeneration:buttons:download")}
          </Button>
        </Box>
      </Box>
    </Footer>
  );
}
