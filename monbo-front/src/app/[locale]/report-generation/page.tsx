import { Box } from "@mui/material";
import initTranslations from "@/utils/i18n";
import { BasePageProps } from "@/interfaces";
import TranslationsProvider from "@/context/TranslationProvider";
import { NavigateHomepageWhenEmptyData } from "@/components/reusable/NavigateHomepageWhenEmptyData";
import { SearchBar } from "@/components/reusable/inputs/SearchBar";
import { SectionBackground } from "@/components/reusable/SectionBackground";
import { PageTitle } from "@/components/page/reportGeneration/PageTitle";
import { DeforestationResultsTable } from "@/components/page/reportGeneration/DeforestationResultsTable";
import { PageFooter } from "@/components/page/reportGeneration/PageFooter";

const namespaces = ["common", "deforestationAnalysis", "reportGeneration"];

export default async function DeforestationAnalysis({ params }: BasePageProps) {
  const { locale } = await params;
  const { t, resources } = await initTranslations(locale, namespaces);

  return (
    <TranslationsProvider
      locale={locale}
      namespaces={namespaces}
      resources={resources}
    >
      <NavigateHomepageWhenEmptyData />
      <Box
        sx={{
          padding: 3,
          paddingBottom: 11,
          display: "flex",
          flexDirection: "column",
          gap: 2,
          height: "calc(100vh - 64px)",
        }}
      >
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <PageTitle />
          <SearchBar placeholder={t("reportGeneration:searchPlaceholder")} />
        </Box>
        <SectionBackground
          sx={{ alignSelf: "stretch", flexGrow: 1, minHeight: 300, padding: 0 }}
        >
          <DeforestationResultsTable />
        </SectionBackground>
      </Box>
      <PageFooter />
    </TranslationsProvider>
  );
}
