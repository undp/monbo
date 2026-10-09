import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Every namespace must define the same keys in English and Spanish: a key missing
// in one language shows up as its raw key in the UI.

const LOCALES_DIR = path.join(process.cwd(), "src", "locales");
const LANGUAGES = ["en", "es"] as const;

const namespaces = (language: string) =>
  readdirSync(path.join(LOCALES_DIR, language))
    .filter((file) => file.endsWith(".json"))
    .map((file) => file.replace(/\.json$/, ""))
    .sort();

/** Nested keys as dotted paths: { a: { b: "" } } → ["a.b"]. */
const flattenKeys = (value: unknown, prefix = ""): string[] =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? Object.entries(value).flatMap(([key, child]) =>
        flattenKeys(child, prefix ? `${prefix}.${key}` : key)
      )
    : [prefix];

const keys = (language: string, namespace: string) =>
  new Set(
    flattenKeys(
      JSON.parse(
        readFileSync(path.join(LOCALES_DIR, language, `${namespace}.json`), "utf8")
      )
    )
  );

describe("translations", () => {
  it("have the same namespaces in every language", () => {
    expect(namespaces("es")).toEqual(namespaces("en"));
  });

  it.each(namespaces("en"))("%s has the same keys in en and es", (namespace) => {
    const [en, es] = LANGUAGES.map((language) => keys(language, namespace));
    const missing = {
      es: [...en].filter((key) => !es.has(key)).map((key) => `${namespace}: ${key}`),
      en: [...es].filter((key) => !en.has(key)).map((key) => `${namespace}: ${key}`),
    };
    expect(missing).toEqual({ es: [], en: [] });
  });
});
