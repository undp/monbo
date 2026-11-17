import { Box } from "@mui/material";
import { Text } from "@/components/reusable/Text";
import { SectionBackground } from "@/components/reusable/SectionBackground";
import { Tabs } from "@/components/reusable/Tabs";
import { DownloadPageData } from "@/components/page/polygonsValidation/DownloadPageData";
import { InconsistentFarmsTable } from "@/components/page/polygonsValidation/InconsistentFarmsTable";
import { ValidFarmsTable } from "@/components/page/polygonsValidation/ValidFarmsTable";
import { TabTitle } from "@/components/page/polygonsValidation/TabTitle";
import { PageFooter } from "@/components/page/polygonsValidation/PageFooter";
import TranslationsProvider from "@/context/TranslationProvider";
import { BasePageProps } from "@/interfaces";
import initTranslations from "@/utils/i18n";
import { SearchBar } from "@/components/reusable/inputs/SearchBar";
import { Suspense } from "react";
import { NavigateHomepageWhenEmptyData } from "@/components/reusable/NavigateHomepageWhenEmptyData";
import { StageEyebrow } from "@/components/page/flow/StageEyebrow";
import { RESULTS_SECTION_HEIGHT } from "@/components/page/flow/flowLayoutSizes";

const namespaces = ["common", "polygonValidation", "deforestationAnalysis", "flow"];

export default async function PolygonsValidationPage({
  params,
}: BasePageProps) {
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
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
          }}
        >
          <Box>
            <StageEyebrow />
            <Text variant="h3" bold>
              {t("polygonValidation:title")}
            </Text>
          </Box>
          <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
            <Suspense>
              <SearchBar
                placeholder={t("polygonValidation:searchPlaceholder")}
                style={{ minWidth: "400px" }}
              />
            </Suspense>
            <DownloadPageData />
          </Box>
        </Box>
        <SectionBackground
          sx={{ alignSelf: "stretch", height: RESULTS_SECTION_HEIGHT }}
        >
          <Suspense>
            <Tabs
              tabs={[
                {
                  id: "validated",
                  title: <TabTitle type="valid" />,
                  content: <ValidFarmsTable />,
                },
                {
                  id: "inconsistents",
                  title: <TabTitle type="inconsistent" />,
                  content: <InconsistentFarmsTable />,
                },
              ]}
            />
          </Suspense>
        </SectionBackground>
        <PageFooter />
      </Box>
    </TranslationsProvider>
  );
}
