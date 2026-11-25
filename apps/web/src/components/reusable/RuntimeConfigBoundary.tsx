import initTranslations from "@/utils/i18n";
import TranslationsProvider from "@/context/TranslationProvider";
import { RuntimeConfigGate } from "@/components/reusable/RuntimeConfigGate";

/** Server wrapper for RuntimeConfigGate: gives its loading and error states their
 * translations (the pages bring their own providers for their content). */
export const RuntimeConfigBoundary = async ({
  locale,
  children,
}: {
  locale: string;
  children: React.ReactNode;
}) => {
  const { resources } = await initTranslations(locale, ["common"]);

  return (
    <TranslationsProvider
      locale={locale}
      namespaces={["common"]}
      resources={resources}
    >
      <RuntimeConfigGate>{children}</RuntimeConfigGate>
    </TranslationsProvider>
  );
};
