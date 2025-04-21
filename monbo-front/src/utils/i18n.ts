import { createInstance, i18n, Resource } from "i18next";
import { initReactI18next } from "react-i18next/initReactI18next";
import resourcesToBackend from "i18next-resources-to-backend";
import i18nConfig from "@/i18nConfig";

import esCommon from "@/locales/es/common.json";
import esHome from "@/locales/es/home.json";
import esPolygonValidation from "@/locales/es/polygonValidation.json";
import esDeforestationAnalysis from "@/locales/es/deforestationAnalysis.json";
import esReportGeneration from "@/locales/es/reportGeneration.json";

import enCommon from "@/locales/en/common.json";
import enHome from "@/locales/en/home.json";
import enPolygonValidation from "@/locales/en/polygonValidation.json";
import enDeforestationAnalysis from "@/locales/en/deforestationAnalysis.json";
import enReportGeneration from "@/locales/en/reportGeneration.json";

const localeAssets: Record<string, unknown> = {
  "es-common": esCommon,
  "es-home": esHome,
  "es-polygonValidation": esPolygonValidation,
  "es-deforestationAnalysis": esDeforestationAnalysis,
  "es-reportGeneration": esReportGeneration,
  "en-common": enCommon,
  "en-home": enHome,
  "en-polygonValidation": enPolygonValidation,
  "en-deforestationAnalysis": enDeforestationAnalysis,
  "en-reportGeneration": enReportGeneration,
};

/**
 * Initializes the i18n translations for the given locale and namespaces.
 *
 * @param locale - The locale to initialize the translations for.
 * @param namespaces - An array of namespaces to load translations for.
 * @param i18nInstance - An optional i18n instance to use. If not provided, a new instance will be created.
 * @param resources - Optional resources to use for translations. If not provided, resources will be loaded from localeAssets.
 * @returns An object containing the initialized i18n instance, the loaded resources, and the translation function `t`.
 */
export default async function initTranslations(
  locale: string,
  namespaces: string[],
  i18nInstance?: i18n,
  resources?: Resource
) {
  i18nInstance = i18nInstance || createInstance();

  i18nInstance.use(initReactI18next);

  if (!resources) {
    i18nInstance.use(
      resourcesToBackend(
        (language: string, namespace: string) =>
          localeAssets[`${language}-${namespace}`]
      )
    );
  }

  await i18nInstance.init({
    lng: locale,
    resources,
    fallbackLng: i18nConfig.defaultLocale,
    supportedLngs: i18nConfig.locales,
    defaultNS: namespaces[0],
    fallbackNS: namespaces[0],
    ns: namespaces,
    preload: resources ? [] : i18nConfig.locales,
  });

  return {
    i18n: i18nInstance,
    resources: i18nInstance.services.resourceStore.data,
    t: i18nInstance.t,
  };
}
