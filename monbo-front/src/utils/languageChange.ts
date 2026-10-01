import i18nConfig from "@/i18nConfig";

/** `path` in `locale`: next-i18n-router serves the default locale without a prefix. */
export const localizedPath = (path: string, locale: string) =>
  locale === i18nConfig.defaultLocale
    ? path
    : `/${locale}${path === "/" ? "" : path}`;
