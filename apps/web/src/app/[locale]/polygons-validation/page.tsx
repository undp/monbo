import { Box } from "@mui/material";
import { DownloadPageData } from "@/components/page/polygonsValidation/DownloadPageData";
import { ValidationResultsTable } from "@/components/page/polygonsValidation/ValidationResultsTable";
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
        <Suspense>
          <ValidationKpis />
        </Suspense>
        <Suspense>
          <ValidationResultsTable />
        </Suspense>
        <PageFooter />
      </FlowPage>
    </TranslationsProvider>
  );
}
