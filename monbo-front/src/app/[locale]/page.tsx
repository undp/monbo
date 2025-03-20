import {
  PolygonValidationModuleCard,
  DeforestationModuleCard,
  BatchCreationModuleCard,
  ReportCreationModuleCard,
} from "@/components/page/home";
import TranslationsProvider from "@/context/TranslationProvider";
import initTranslations from "@/utils/i18n";
import { Box, Grid2, Typography } from "@mui/material";
import { BasePageProps } from "@/interfaces";
import { DevEnvWarning } from "@/components/reusable/DevEnvWarning";

export default async function HomePage({ params }: BasePageProps) {
  const { locale } = await params;
  const { t, resources } = await initTranslations(locale, ["common", "home"]);

  return (
    <TranslationsProvider
      locale={locale}
      namespaces={["common", "home"]}
      resources={resources}
    >
      <Box
        sx={{
          maxWidth: 1280,
          margin: "0px auto",
          display: "flex",
          justifyContent: "flex-end",
          padding: "16px 24px 0 0",
        }}
      >
        <DevEnvWarning />
      </Box>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          minHeight: "calc(100vh - 64px - 64px)",
        }}
      >
        <div
          style={{
            maxWidth: 1280,
            padding: 24,
            color: "#3A3541",
            alignSelf: "stretch",
            display: "flex",
            flexDirection: "column",
            marginTop: "10px",
          }}
        >
          <Typography
            variant="h1"
            style={{
              fontSize: 34,
              fontWeight: 500,
              lineHeight: "47px",
              textAlign: "center",
              marginBottom: 16,
            }}
          >
            {t("home:title")}
          </Typography>
          <Typography
            variant="h2"
            style={{
              fontSize: 20,
              fontWeight: 400,
              lineHeight: "27px",
              textAlign: "center",
              marginBottom: 54,
            }}
          >
            {t("home:subtitle")}
          </Typography>

          <Grid2 container spacing={3}>
            <Grid2 size={6}>
              <PolygonValidationModuleCard />
            </Grid2>
            <Grid2 size={6}>
              <DeforestationModuleCard />
            </Grid2>
            <Grid2 size={6}>
              <BatchCreationModuleCard />
            </Grid2>
            <Grid2 size={6}>
              <ReportCreationModuleCard />
            </Grid2>
          </Grid2>
        </div>
      </div>
    </TranslationsProvider>
  );
}
