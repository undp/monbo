import initTranslations from "@/utils/i18n";
import { BasePageProps } from "@/interfaces";
import TranslationsProvider from "@/context/TranslationProvider";
import { NavigateHomepageWhenEmptyData } from "@/components/reusable/NavigateHomepageWhenEmptyData";
import { AnalysisOutdatedGuard } from "@/components/reusable/AnalysisOutdatedGuard";
import { ReportPageContent } from "@/components/page/reportGeneration/ReportPageContent";

const namespaces = ["common", "territorialAnalysis", "reportGeneration", "flow"];

export default async function ReportGeneration({ params }: BasePageProps) {
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
        <ReportPageContent />
      </AnalysisOutdatedGuard>
    </TranslationsProvider>
  );
}
