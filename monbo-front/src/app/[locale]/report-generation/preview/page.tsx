import { NavigateHomepageWhenEmptyData } from "@/components/reusable/NavigateHomepageWhenEmptyData";
import TranslationsProvider from "@/context/TranslationProvider";
import { ReportGenerationPreviewPageContent } from "@/components/page/reportGeneration/preview/ReportGenerationPreviewPageContent";
import initTranslations from "@/utils/i18n";
import { PageWithSearchParams } from "@/interfaces";
import { PageFooter } from "@/components/page/reportGeneration/preview/PageFooter";

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
      <NavigateHomepageWhenEmptyData />
      <ReportGenerationPreviewPageContent />
      <PageFooter />
    </TranslationsProvider>
  );
}
