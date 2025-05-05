import TranslationsProvider from "@/context/TranslationProvider";
import { DeforestationAnalysisUploadDataPageContent } from "@/components/page/deforestationAnalysis/DeforestationAnalysisUploadDataPageContent";
import { BasePageProps } from "@/interfaces";
import initTranslations from "@/utils/i18n";

const namespaces = ["common", "deforestationAnalysis"];

export default async function UploadDataPage({ params }: BasePageProps) {
  const { locale } = await params;
  const { resources } = await initTranslations(locale, namespaces);

  return (
    <TranslationsProvider
      locale={locale}
      namespaces={namespaces}
      resources={resources}
    >
      <DeforestationAnalysisUploadDataPageContent />
    </TranslationsProvider>
  );
}
