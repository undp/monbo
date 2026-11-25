import TranslationsProvider from "@/context/TranslationProvider";
import { TerritorialAnalysisLayersPageContent } from "@/components/page/territorialAnalysis/TerritorialAnalysisLayersPageContent";
import { BasePageProps } from "@/interfaces";
import initTranslations from "@/utils/i18n";

const namespaces = ["common", "territorialAnalysis", "flow"];

export default async function LayersPage({ params }: BasePageProps) {
  const { locale } = await params;
  const { resources } = await initTranslations(locale, namespaces);

  return (
    <TranslationsProvider
      locale={locale}
      namespaces={namespaces}
      resources={resources}
    >
      <TerritorialAnalysisLayersPageContent />
    </TranslationsProvider>
  );
}
