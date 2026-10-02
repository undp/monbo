import i18nConfig from "@/i18nConfig";

/**
 * Changing the language navigates to another value of the root layout's [locale]
 * segment, which remounts every page. A page holding unsaved input keeps it
 * published here while it is mounted, and its next instance takes it over if it
 * mounts during a language change: React may render it while the old instance is
 * still mounted, or (for parts that wait for data) only after it unmounted. Outside
 * a language change nothing is taken over, so leaving a page still discards its
 * input.
 */

// Long enough for the new language's page to load.
const LANGUAGE_CHANGE_MS = 10_000;
let languageChangedAt = 0;
// droppedAt: when its page unmounted during a language change
const kept = new Map<string, { value: unknown; droppedAt?: number }>();
// Keys whose page already mounted again in the new language: their input was taken
// over, so a later unmount (e.g. leaving the page) discards it like any other.
const settled = new Set<string>();

const changingLanguage = () => Date.now() - languageChangedAt < LANGUAGE_CHANGE_MS;

/** Called by the language menu just before it navigates. */
export const startLanguageChange = () => {
  languageChangedAt = Date.now();
  settled.clear();
};

/** Publishes a mounted page's current input under `key`. */
export const keepForLanguageChange = (key: string, value: unknown) => {
  kept.set(key, { value });
};

/** Called once the page has mounted: its input no longer needs handing over. */
export const settleLanguageChange = (key: string) => {
  settled.add(key);
};

/**
 * Called when the page unmounts: kept for its next instance only while the
 * language is changing and that instance hasn't mounted yet.
 */
export const dropKept = (key: string) => {
  const entry = kept.get(key);
  if (entry && changingLanguage() && !settled.has(key)) entry.droppedAt = Date.now();
  else kept.delete(key);
};

/** The input published under `key`, when mounting during a language change. */
export const takeOverOnLanguageChange = <T>(key: string): T | undefined => {
  const entry = kept.get(key);
  // Not left over from an earlier language change.
  const current = entry && (entry.droppedAt ?? Infinity) >= languageChangedAt;
  return changingLanguage() && current ? (entry.value as T) : undefined;
};

/** `path` in `locale`: next-i18n-router serves the default locale without a prefix. */
export const localizedPath = (path: string, locale: string) =>
  locale === i18nConfig.defaultLocale
    ? path
    : `/${locale}${path === "/" ? "" : path}`;
