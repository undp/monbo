import TranslationsProvider from "@/context/TranslationProvider";
import { TerritorialAnalysisUploadDataPageContent } from "@/components/page/territorialAnalysis/TerritorialAnalysisUploadDataPageContent";
import { BasePageProps } from "@/interfaces";
import initTranslations from "@/utils/i18n";

const namespaces = ["common", "territorialAnalysis", "manualFarm", "flow"];

export default async function UploadDataPage({ params }: BasePageProps) {
  const { locale } = await params;
  const { resources } = await initTranslations(locale, namespaces);

  return (
    <TranslationsProvider
      locale={locale}
      namespaces={namespaces}
      resources={resources}
    >
      <TerritorialAnalysisUploadDataPageContent />
    </TranslationsProvider>
  );
}
