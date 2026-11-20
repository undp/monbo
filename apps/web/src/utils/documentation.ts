import {
  getDeforestationThreshold,
  getOverlapThreshold,
} from "@/config/runtime";
import { formatThreshold } from "./numbers";

// The methodology page (/documentation): one Markdown file per section and
// language under src/content/documentation/<locale>/. The section ids are the
// page's anchors, the same in every language. The layers and limits sections add
// each country's layers (from the API) below their Markdown.
export const DOCUMENTATION_SECTIONS = [
  "calculation",
  "categories",
  "layers",
  "limits",
  "upload",
  "validation",
  "area",
] as const;

// Anchors that used to name a section, and the section they open now: old links
// keep landing on the right place.
export const FORMER_SECTION_ANCHORS: Partial<Record<DocumentationSection, string>> = {
  calculation: "deforestation",
};

export type DocumentationSection = (typeof DOCUMENTATION_SECTIONS)[number];

export type DocumentationContent = Record<DocumentationSection, string>;

// What each placeholder in the Markdown is replaced with. The thresholds are the
// deployment's (GET /config), never written into the text.
const placeholderValues: Record<string, () => number> = {
  overlapThreshold: getOverlapThreshold,
  deforestationThreshold: getDeforestationThreshold,
};

export const DOCUMENTATION_PLACEHOLDERS = Object.keys(placeholderValues);

/** A section's title: the first heading of its Markdown, for the page's index. */
export const sectionTitle = (markdown: string): string =>
  markdown.match(/^#+\s+(.+)$/m)?.[1].trim() ?? "";

const PLACEHOLDER = /\{\{(\w+)\}\}/g;

/** The placeholders a text uses, sorted and without repeats. */
export const findPlaceholders = (markdown: string): string[] =>
  [...new Set([...markdown.matchAll(PLACEHOLDER)].map(([, name]) => name))].sort();

/**
 * Replaces each known placeholder with its threshold, as a percentage in the
 * user's language with the threshold's own decimals ("0,5%"). An unknown one is
 * left as written, so the content tests can catch it.
 */
export const fillDocumentationPlaceholders = (
  markdown: string,
  language: string
): string =>
  markdown.replace(PLACEHOLDER, (placeholder, name: string) =>
    name in placeholderValues
      ? formatThreshold(placeholderValues[name](), language)
      : placeholder
  );
