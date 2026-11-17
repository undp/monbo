import type { LocalizedText } from "@/interfaces/LayerCategory";

/** A text the API sends in every language, in the UI language (Spanish by default). */
export const localizedText = (text: LocalizedText, language: string): string =>
  language.startsWith("en") ? text.en : text.es;
