import type { Root, RootContent } from "mdast";
import remarkDirective from "remark-directive";
import remarkParse from "remark-parse";
import { unified } from "unified";
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
import { DOCUMENTATION_BLOCKS } from "./remarkDocumentationBlocks";

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
  it("has the upload, validation, area and deforestation sections, in that order", () => {
    expect(DOCUMENTATION_SECTIONS).toEqual(["upload", "validation", "area", "deforestation"]);
  });

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

type ContainerDirective = Extract<RootContent, { type: "containerDirective" }>;

/** Every container directive of a Markdown text, nested ones included. */
const containerDirectives = (markdown: string) => {
  const found: ContainerDirective[] = [];
  const visit = (node: Root | RootContent) => {
    if (node.type === "containerDirective") found.push(node);
    if ("children" in node) node.children.forEach(visit);
  };
  const tree = unified().use(remarkParse).use(remarkDirective).parse(markdown);
  visit(tree);
  return { tree, found };
};

const label = (directive: ContainerDirective) => {
  const [first] = directive.children;
  return first?.type === "paragraph" && first.data?.directiveLabel
    ? first.children.map((child) => ("value" in child ? child.value : "")).join("")
    : "";
};

describe("documentation blocks", () => {
  it("uses only the summary and details blocks", async () => {
    for (const locale of ["es", "en"]) {
      const content = await readDocumentation(locale);
      for (const section of DOCUMENTATION_SECTIONS) {
        for (const directive of containerDirectives(content[section]).found) {
          expect(DOCUMENTATION_BLOCKS, `${locale}/${section}`).toContain(directive.name);
        }
      }
    }
  });

  it("starts each section with one summary, right below its heading", async () => {
    for (const locale of ["es", "en"]) {
      const content = await readDocumentation(locale);
      for (const section of DOCUMENTATION_SECTIONS) {
        const { tree, found } = containerDirectives(content[section]);
        const [heading, summary] = tree.children;
        expect(heading.type === "heading" && heading.depth, `${locale}/${section}`).toBe(2);
        expect(summary.type === "containerDirective" && summary.name).toBe("summary");
        expect(found.filter(({ name }) => name === "summary")).toHaveLength(1);
      }
    }
  });

  it("has the same labelled details blocks in both languages", async () => {
    const es = await readDocumentation("es");
    const en = await readDocumentation("en");

    for (const section of DOCUMENTATION_SECTIONS) {
      const details = (markdown: string) =>
        containerDirectives(markdown).found.filter(({ name }) => name === "details");
      const esDetails = details(es[section]);
      const enDetails = details(en[section]);
      expect(enDetails.length, section).toBe(esDetails.length);
      for (const directive of [...esDetails, ...enDetails]) {
        expect(label(directive).trim(), section).not.toBe("");
      }
    }
  });
});
