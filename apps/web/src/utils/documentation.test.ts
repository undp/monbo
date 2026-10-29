import { describe, expect, it } from "vitest";
import { setRuntimeConfig } from "@/config/runtime";
import {
  DOCUMENTATION_PLACEHOLDERS,
  DOCUMENTATION_SECTIONS,
  fillDocumentationPlaceholders,
  findPlaceholders,
  sectionTitle,
} from "./documentation";
import { readDocumentation } from "./documentationContent";

const TEXT =
  "Overlap above {{overlapThreshold}}; deforestation above {{deforestationThreshold}}.";

describe("fillDocumentationPlaceholders", () => {
  it("writes the thresholds as percentages in Spanish and English", () => {
    setRuntimeConfig({
      overlapThresholdPercentage: 1,
      deforestationThresholdPercentage: 2,
    });

    expect(fillDocumentationPlaceholders(TEXT, "es")).toBe(
      "Overlap above 1%; deforestation above 2%."
    );
    expect(fillDocumentationPlaceholders(TEXT, "en")).toBe(
      "Overlap above 1%; deforestation above 2%."
    );
  });

  it("keeps the threshold's decimals", () => {
    setRuntimeConfig({
      overlapThresholdPercentage: 0.25,
      deforestationThresholdPercentage: 0.5,
    });

    expect(fillDocumentationPlaceholders(TEXT, "es")).toBe(
      "Overlap above 0,25%; deforestation above 0,5%."
    );
    expect(fillDocumentationPlaceholders(TEXT, "en")).toBe(
      "Overlap above 0.25%; deforestation above 0.5%."
    );
  });

  it("writes a threshold of 0 as 0%", () => {
    setRuntimeConfig({
      overlapThresholdPercentage: 0,
      deforestationThresholdPercentage: 0,
    });

    expect(fillDocumentationPlaceholders(TEXT, "es")).toBe(
      "Overlap above 0%; deforestation above 0%."
    );
  });

  it("leaves an unknown placeholder as written", () => {
    setRuntimeConfig({
      overlapThresholdPercentage: 1,
      deforestationThresholdPercentage: 2,
    });

    expect(fillDocumentationPlaceholders("{{foo}} and {{overlapThreshold}}", "en")).toBe(
      "{{foo}} and 1%"
    );
  });

  it("returns text with no placeholders unchanged", () => {
    expect(fillDocumentationPlaceholders("No numbers *here*.", "es")).toBe(
      "No numbers *here*."
    );
  });
});

describe("sectionTitle", () => {
  it("is the first heading", () => {
    expect(sectionTitle("## Farm area\n\nText\n\n### Points")).toBe("Farm area");
  });

  it("is empty without a heading", () => {
    expect(sectionTitle("Just text")).toBe("");
  });
});

describe("documentation content", () => {
  it("has the same sections in both languages, none empty", async () => {
    for (const locale of ["es", "en"]) {
      const content = await readDocumentation(locale);
      expect(Object.keys(content).sort()).toEqual([...DOCUMENTATION_SECTIONS].sort());
      for (const section of DOCUMENTATION_SECTIONS) {
        expect(content[section].trim()).not.toBe("");
        expect(sectionTitle(content[section]), section).not.toBe("");
      }
    }
  });

  it("uses the same known placeholders in both languages", async () => {
    const es = await readDocumentation("es");
    const en = await readDocumentation("en");

    for (const section of DOCUMENTATION_SECTIONS) {
      const esPlaceholders = findPlaceholders(es[section]);
      expect(findPlaceholders(en[section]), section).toEqual(esPlaceholders);
      for (const placeholder of esPlaceholders) {
        expect(DOCUMENTATION_PLACEHOLDERS, placeholder).toContain(placeholder);
      }
    }
  });

  it("states each threshold through its placeholder", async () => {
    const es = await readDocumentation("es");

    expect(findPlaceholders(es.validation)).toContain("overlapThreshold");
    expect(findPlaceholders(es.deforestation)).toContain("deforestationThreshold");
  });
});
