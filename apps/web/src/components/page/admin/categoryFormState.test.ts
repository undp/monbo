import { describe, expect, it } from "vitest";
import { makeAdminCategory } from "@/test/factories";
import {
  CategoryFormValues,
  categoryValidators,
  toCategoryFormValues,
  toCategoryInput,
} from "./categoryFormState";

const filled = (overrides: Partial<CategoryFormValues> = {}): CategoryFormValues => ({
  ...toCategoryFormValues(),
  name: { es: " Frontera agrícola ", en: "Agricultural frontier" },
  description: { es: "Zonas agrícolas.", en: "" },
  polarity: "required",
  resultLabels: {
    ok: { es: "Dentro de la frontera", en: "Inside the frontier" },
    flagged: { es: "Fuera de la frontera", en: "Outside the frontier" },
  },
  ...overrides,
});

describe("category form values", () => {
  it("starts a new category without a polarity and with the global threshold", () => {
    const values = toCategoryFormValues();
    expect(values.polarity).toBeNull();
    expect(values.useGlobalThreshold).toBe(true);
    expect(values.temporal).toBe(false);
  });

  it("starts from a stored category", () => {
    const values = toCategoryFormValues(
      makeAdminCategory({ polarity: "avoid", thresholdPercentage: 5 })
    );
    expect(values.polarity).toBe("avoid");
    expect(values.useGlobalThreshold).toBe(false);
    expect(values.threshold).toBe("5");
  });

  it("sends the global threshold as null and trims the texts", () => {
    const input = toCategoryInput(filled());
    expect(input.thresholdPercentage).toBeNull();
    expect(input.name.es).toBe("Frontera agrícola");
    expect(input.polarity).toBe("required");
  });

  it("sends the category's own threshold", () => {
    const input = toCategoryInput(filled({ useGlobalThreshold: false, threshold: "2.5" }));
    expect(input.thresholdPercentage).toBe(2.5);
  });

  it("never sends a default polarity", () => {
    expect(() => toCategoryInput(filled({ polarity: null }))).toThrow();
  });
});

describe("category validators", () => {
  it("refuses to save without a polarity", () => {
    expect(categoryValidators.polarity(null)).toBe("admin:categories:form:errors:polarity");
    expect(categoryValidators.polarity("avoid")).toBe(true);
  });

  it("checks the threshold only when the category has its own", () => {
    expect(categoryValidators.threshold("", filled())).toBe(true);
    const own = filled({ useGlobalThreshold: false });
    expect(categoryValidators.threshold("", own)).toBe("admin:categories:form:errors:threshold");
    expect(categoryValidators.threshold("101", own)).toBe(
      "admin:categories:form:errors:threshold"
    );
    expect(categoryValidators.threshold("0", own)).toBe(true);
  });

  it("checks the color", () => {
    expect(categoryValidators.color("#a8741a")).toBe(true);
    expect(categoryValidators.color("a8741a")).toBe("admin:categories:form:errors:color");
  });
});
