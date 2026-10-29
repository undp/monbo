import { readFile } from "fs/promises";
import path from "path";
import {
  DOCUMENTATION_SECTIONS,
  type DocumentationContent,
} from "./documentation";

// Server only: reads the files from disk. next.config.ts traces them into the
// standalone build, should the page ever render at runtime.
const CONTENT_DIR = path.join(process.cwd(), "src/content/documentation");

/** The documentation page's Markdown for a language, one string per section. */
export const readDocumentation = async (
  locale: string
): Promise<DocumentationContent> => {
  const texts = await Promise.all(
    DOCUMENTATION_SECTIONS.map((section) =>
      readFile(path.join(CONTENT_DIR, locale, `${section}.md`), "utf-8")
    )
  );
  return Object.fromEntries(
    DOCUMENTATION_SECTIONS.map((section, i) => [section, texts[i]])
  ) as DocumentationContent;
};
