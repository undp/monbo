import type { i18n } from "i18next";
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

const instances = new Map<TestLocale, Promise<i18n>>();

/**
 * A real i18n instance with the app's translation files, as users see them. One per
 * locale and test file: don't change its language. Its first creation needs real
 * timers, so a test that fakes them creates the instances it needs first.
 */
export const createTestI18n = (locale: TestLocale) => {
  if (!instances.has(locale)) {
    instances.set(
      locale,
      initTranslations(locale, NAMESPACES).then(({ i18n }) => i18n)
    );
  }
  return instances.get(locale)!;
};
