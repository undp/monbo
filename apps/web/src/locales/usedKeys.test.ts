import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Every literal `t("namespace:key")` in the app must name a key that exists in that
// namespace. A missing key only works when `common` happens to have it (the
// fallback namespace), and shows as the raw key on any page where it doesn't.
// Keys built at runtime (template literals, variables) are not checked here.

const SRC_DIR = path.join(process.cwd(), "src");
const LOCALES_DIR = path.join(SRC_DIR, "locales");
const LANGUAGES = ["es", "en"] as const;

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [full] : [];
  });

const LITERAL_KEY = /\bt\(\s*["']([A-Za-z]+):([A-Za-z0-9_:.]+)["']/g;

const usedKeys = sourceFiles(SRC_DIR).flatMap((file) =>
  [...readFileSync(file, "utf8").matchAll(LITERAL_KEY)].map(([, namespace, key]) => ({
    file: path.relative(SRC_DIR, file),
    namespace,
    key,
  }))
);

const translations = (language: string, namespace: string): unknown => {
  const file = path.join(LOCALES_DIR, language, `${namespace}.json`);
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return undefined;
  }
};

/** Whether `parts` leads to a value, or to the `_one`/`_other` forms of a plural. */
const hasKey = (tree: unknown, parts: string[]): boolean => {
  const last = parts.length - 1;
  let node = tree;
  for (const [index, part] of parts.entries()) {
    if (node === null || typeof node !== "object") return false;
    const record = node as Record<string, unknown>;
    if (index === last) {
      return [part, `${part}_one`, `${part}_other`].some((name) => name in record);
    }
    node = record[part];
  }
  return false;
};

describe("translation keys used in the code", () => {
  it("finds the literal keys", () => {
    expect(usedKeys.length).toBeGreaterThan(100);
  });

  it.each(LANGUAGES)("exist in the namespace they name, in %s", (language) => {
    const missing = usedKeys
      .filter(({ namespace, key }) => !hasKey(translations(language, namespace), key.split(/[:.]/)))
      .map(({ file, namespace, key }) => `${file}: ${namespace}:${key}`);
    expect(missing).toEqual([]);
  });
});
