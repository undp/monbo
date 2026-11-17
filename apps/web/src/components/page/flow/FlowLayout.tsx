import TranslationsProvider from "@/context/TranslationProvider";
import initTranslations from "@/utils/i18n";
import { FlowHeader } from "./FlowHeader";

// The flow header's texts, plus those of the analysis and report modals its
// stepper can open. `common` goes first: it is the fallback namespace, where keys
// such as the testing-environment warning's `home:devWarning` resolve.
const namespaces = [
  "common",
  "flow",
  "polygonValidation",
  "deforestationAnalysis",
  "reportGeneration",
];

interface Props {
  locale: string;
  children: React.ReactNode;
}

/** A stage page under the flow header. Rendered by each stage's layout. */
export const FlowLayout = async ({ locale, children }: Props) => {
  const { resources } = await initTranslations(locale, namespaces);

  return (
    <>
      <TranslationsProvider locale={locale} namespaces={namespaces} resources={resources}>
        <FlowHeader />
      </TranslationsProvider>
      {children}
    </>
  );
};
