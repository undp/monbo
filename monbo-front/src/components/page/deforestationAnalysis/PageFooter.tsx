import { DevEnvWarning } from "@/components/reusable/DevEnvWarning";
import { Footer } from "@/components/reusable/Footer";
import initTranslations from "@/utils/i18n";
import { Box, Button } from "@mui/material";

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
          <Button variant="contained" disabled>
            {t("deforestationAnalysis:buttons:createReport")}
          </Button>
          <Button variant="contained" disabled>
            {t("deforestationAnalysis:buttons:createLot")}
          </Button>
        </Box>
      </Box>
    </Footer>
  );
}
