import { NavigateHomepageWhenEmptyData } from "@/components/reusable/NavigateHomepageWhenEmptyData";
import TranslationsProvider from "@/context/TranslationProvider";
import { ReportGenerationPreviewPageContent } from "@/components/page/reportGeneration/preview/ReportGenerationPreviewPageContent";
import initTranslations from "@/utils/i18n";
import { PageWithSearchParams } from "@/interfaces";
import { PageFooter } from "@/components/page/reportGeneration/preview/PageFooter";
import { AnalysisOutdatedGuard } from "@/components/reusable/AnalysisOutdatedGuard";
import { ReportProvider } from "@/context/ReportContext";

const namespaces = ["common", "deforestationAnalysis", "reportGeneration"];

export default async function ReportGenerationPreviewPage({
  params,
}: PageWithSearchParams<{ locale: string }>) {
  const { locale } = await params;
  const { resources } = await initTranslations(locale, namespaces);

  return (
    <TranslationsProvider
      locale={locale}
      namespaces={namespaces}
      resources={resources}
    >
      <AnalysisOutdatedGuard locale={locale}>
        <NavigateHomepageWhenEmptyData />
        <ReportProvider>
          <ReportGenerationPreviewPageContent />
          <PageFooter />
        </ReportProvider>
      </AnalysisOutdatedGuard>
    </TranslationsProvider>
  );
}
