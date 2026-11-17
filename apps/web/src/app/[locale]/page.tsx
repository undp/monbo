import TranslationsProvider from "@/context/TranslationProvider";
import initTranslations from "@/utils/i18n";
import { BasePageProps } from "@/interfaces";
import { LandingPageContent } from "@/components/page/landing/LandingPageContent";

const namespaces = ["common", "home"];

// The start page: the three steps of the flow and the choice of country.
export default async function LandingPage({ params }: BasePageProps) {
  const { locale } = await params;
  const { resources } = await initTranslations(locale, namespaces);

  return (
    <TranslationsProvider
      locale={locale}
      namespaces={namespaces}
      resources={resources}
    >
      <LandingPageContent />
    </TranslationsProvider>
  );
}
