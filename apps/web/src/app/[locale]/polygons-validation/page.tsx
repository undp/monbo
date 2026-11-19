import { Box } from "@mui/material";
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
import { FlowPage } from "@/components/page/flow/FlowPage";
import { FlowPageHead } from "@/components/page/flow/FlowPageHead";
import { ValidationKpis } from "@/components/page/polygonsValidation/ValidationKpis";
import { RESULTS_SECTION_HEIGHT } from "@/components/page/flow/flowLayoutSizes";

const namespaces = ["common", "polygonValidation", "territorialAnalysis", "flow"];

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
      <FlowPage>
        <FlowPageHead
          title={t("polygonValidation:title")}
          subtitle={t("polygonValidation:subtitle")}
          actions={
            // On a phone the search bar takes the row, next to the download button.
            <Box
              sx={{
                display: "flex",
                gap: 2,
                alignItems: "center",
                width: { xs: "100%", sm: "auto" },
              }}
            >
              <Suspense>
                <SearchBar
                  placeholder={t("polygonValidation:searchPlaceholder")}
                  style={{ flex: { xs: 1, sm: "none" }, minWidth: { xs: 0, sm: "400px" } }}
                />
              </Suspense>
              <DownloadPageData />
            </Box>
          }
        />
        <ValidationKpis />
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
      </FlowPage>
    </TranslationsProvider>
  );
}
