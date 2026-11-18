import { Suspense } from "react";
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
import { AnalysisOutdatedGuard } from "@/components/reusable/AnalysisOutdatedGuard";
import { StageEyebrow } from "@/components/page/flow/StageEyebrow";
import { RESULTS_SECTION_HEIGHT } from "@/components/page/flow/flowLayoutSizes";

const namespaces = ["common", "deforestationAnalysis", "reportGeneration", "flow"];

export default async function DeforestationAnalysis({ params }: BasePageProps) {
  const { locale } = await params;
  const { t, resources } = await initTranslations(locale, namespaces);

  return (
    <TranslationsProvider
      locale={locale}
      namespaces={namespaces}
      resources={resources}
    >
      <AnalysisOutdatedGuard locale={locale}>
        <NavigateHomepageWhenEmptyData />
        <Box
          sx={{
            padding: 3,
            paddingBottom: 11,
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          <Box
            sx={{
              display: "flex",
              flexWrap: "wrap",
              gap: 2,
              justifyContent: "space-between",
              alignItems: "flex-end",
            }}
          >
            <Box>
              <StageEyebrow />
              <PageTitle />
            </Box>
            <Suspense>
              <SearchBar
                placeholder={t("reportGeneration:searchPlaceholder")}
                style={{ minWidth: { xs: "100%", sm: "400px" } }}
              />
            </Suspense>
          </Box>
          <SectionBackground
            sx={{ alignSelf: "stretch", height: RESULTS_SECTION_HEIGHT, padding: 0 }}
          >
            <Suspense>
              <DeforestationResultsTable />
            </Suspense>
          </SectionBackground>
        </Box>
        <PageFooter />
      </AnalysisOutdatedGuard>
    </TranslationsProvider>
  );
}
