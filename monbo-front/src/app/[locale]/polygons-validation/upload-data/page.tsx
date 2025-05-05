import TranslationsProvider from "@/context/TranslationProvider";
import { PolygonsValidationUploadDataPageContent } from "@/components/page/polygonsValidation/PolygonsValidationUploadDataPageContent";
import { BasePageProps } from "@/interfaces";
import initTranslations from "@/utils/i18n";

const namespaces = ["common", "polygonValidation"];

export default async function UploadDataPage({ params }: BasePageProps) {
  const { locale } = await params;
  const { resources } = await initTranslations(locale, namespaces);

  return (
    <TranslationsProvider
      locale={locale}
      namespaces={namespaces}
      resources={resources}
    >
      <PolygonsValidationUploadDataPageContent />
    </TranslationsProvider>
  );
}
