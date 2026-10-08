import initTranslations from "@/utils/i18n";

const NAMESPACES = [
  "common",
  "home",
  "polygonValidation",
  "deforestationAnalysis",
  "reportGeneration",
  "admin",
];

export type TestLocale = "es" | "en";

/** A real i18n instance with the app's translation files, as users see them. */
export const createTestI18n = async (locale: TestLocale) =>
  (await initTranslations(locale, NAMESPACES)).i18n;
