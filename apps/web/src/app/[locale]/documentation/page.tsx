import { MethodologyDocument } from "@/components/page/documentation/MethodologyDocument";
import TranslationsProvider from "@/context/TranslationProvider";
import { BasePageProps } from "@/interfaces";
import initTranslations from "@/utils/i18n";
import { readDocumentation } from "@/utils/documentationContent";

// No RequireCountry: the page can be read from the landing, before choosing one.
export default async function DocumentationPage({ params }: BasePageProps) {
  const { locale } = await params;
  const { resources } = await initTranslations(locale, ["common"]);
  const content = await readDocumentation(locale);

  return (
    <TranslationsProvider
      locale={locale}
      namespaces={["common"]}
      resources={resources}
    >
      <MethodologyDocument content={content} />
    </TranslationsProvider>
  );
}
