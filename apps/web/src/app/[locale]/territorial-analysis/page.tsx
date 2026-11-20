import TranslationsProvider from "@/context/TranslationProvider";
import { PageWithSearchParams } from "@/interfaces";
import initTranslations from "@/utils/i18n";
import { FlowPage } from "@/components/page/flow/FlowPage";
import { PageFooter } from "@/components/page/territorialAnalysis/PageFooter";
import { PageTitle } from "@/components/page/territorialAnalysis/PageTitle";
import { NavigateHomepageWhenEmptyData } from "@/components/reusable/NavigateHomepageWhenEmptyData";
import { DownloadPageData } from "@/components/page/territorialAnalysis/DownloadPageData";
import { AnalysisOutdatedGuard } from "@/components/reusable/AnalysisOutdatedGuard";
import { CategorySummaryCards } from "@/components/page/territorialAnalysis/CategorySummaryCards";
import { ChangeLayersButton } from "@/components/page/territorialAnalysis/ChangeLayersButton";
import { LayerResultsSection } from "@/components/page/territorialAnalysis/LayerResultsSection";

const namespaces = ["common", "territorialAnalysis", "reportGeneration", "flow"];

interface SearchParams {
  view: "table" | "map";
  selectedMapId?: string;
}

export default async function TerritorialAnalysis({
  params,
  searchParams,
}: PageWithSearchParams<SearchParams>) {
  const { locale } = await params;
  const { view } = await searchParams;
  const { resources } = await initTranslations(locale, namespaces);

  return (
    <TranslationsProvider
      locale={locale}
      namespaces={namespaces}
      resources={resources}
    >
      <AnalysisOutdatedGuard locale={locale}>
        <NavigateHomepageWhenEmptyData />
        <FlowPage>
          <PageTitle
            actions={
              <>
                <ChangeLayersButton />
                <DownloadPageData />
              </>
            }
          />
          <CategorySummaryCards />
          <LayerResultsSection view={view === "map" ? "map" : "table"} />
          <PageFooter />
        </FlowPage>
      </AnalysisOutdatedGuard>
    </TranslationsProvider>
  );
}
