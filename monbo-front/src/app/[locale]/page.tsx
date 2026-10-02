import TranslationsProvider from "@/context/TranslationProvider";
import initTranslations from "@/utils/i18n";
import { Box } from "@mui/material";
import { BasePageProps } from "@/interfaces";
import { DevEnvWarning } from "@/components/reusable/DevEnvWarning";
import { SHOW_TESTING_ENVIRONMENT_WARNING } from "@/config/env";
import { LandingPageContent } from "@/components/page/landing/LandingPageContent";

const namespaces = ["common", "home"];

// Landing page: the analysis country is chosen here, on a map.
export default async function LandingPage({ params }: BasePageProps) {
  const { locale } = await params;
  const { resources } = await initTranslations(locale, namespaces);

  return (
    <TranslationsProvider
      locale={locale}
      namespaces={namespaces}
      resources={resources}
    >
      {SHOW_TESTING_ENVIRONMENT_WARNING && (
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
      )}
      <LandingPageContent />
    </TranslationsProvider>
  );
}
