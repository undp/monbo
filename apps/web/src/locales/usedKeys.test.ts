import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Every literal translation key in the app, written as "namespace:key", must name a
// text that exists in that namespace. A missing key only works when `common` happens
// to have it (the fallback namespace), and shows as the raw key on any page where it
// doesn't; a key that names a group of texts shows "key returned an object".
//
// It finds any string literal that starts with a real namespace and a ":", wherever it
// is written: in a t() call, a ternary, a constant or a prop. Keys built at runtime
// (`${prefix}:title`, a variable) are not checked here.

const SRC_DIR = path.join(process.cwd(), "src");
const LOCALES_DIR = path.join(SRC_DIR, "locales");
const LANGUAGES = ["es", "en"] as const;

const NAMESPACES = readdirSync(path.join(LOCALES_DIR, "es"))
  .filter((file) => file.endsWith(".json"))
  .map((file) => file.replace(/\.json$/, ""));

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [full] : [];
  });

// A whole literal: the closing quote must match the opening one, so a template
// prefix such as `admin:x:${id}` is not taken for the key "admin:x".
const LITERAL_KEY = new RegExp(
  `(["'\`])(${NAMESPACES.join("|")}):([A-Za-z0-9_:.]+)\\1`,
  "g"
);

const usedKeys = sourceFiles(SRC_DIR).flatMap((file) =>
  [...readFileSync(file, "utf8").matchAll(LITERAL_KEY)].map(([, , namespace, key]) => ({
    file: path.relative(SRC_DIR, file),
    namespace,
    key,
  }))
);

const translations = (language: string, namespace: string): unknown =>
  JSON.parse(readFileSync(path.join(LOCALES_DIR, language, `${namespace}.json`), "utf8"));

/** The text `parts` leads to, taking the `_one`/`_other` forms of a plural. */
const textAt = (tree: unknown, parts: string[]): unknown => {
  const last = parts.length - 1;
  let node = tree;
  for (const [index, part] of parts.entries()) {
    if (node === null || typeof node !== "object") return undefined;
    const record = node as Record<string, unknown>;
    node = index === last && !(part in record) ? record[`${part}_other`] : record[part];
  }
  return node;
};

describe("translation keys used in the code", () => {
  it("finds the literal keys", () => {
    expect(usedKeys.length).toBeGreaterThan(100);
  });

  it.each(LANGUAGES)("name a text in the namespace they name, in %s", (language) => {
    const wrong = usedKeys
      .map(({ file, namespace, key }) => {
        const text = textAt(translations(language, namespace), key.split(/[:.]/));
        if (typeof text === "string") return null;
        const problem = text === undefined ? "missing" : "not a text";
        return `${file}: ${namespace}:${key} (${problem})`;
      })
      .filter(Boolean);
    expect(wrong).toEqual([]);
  });
});
