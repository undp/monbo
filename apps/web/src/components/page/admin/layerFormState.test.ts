import { describe, expect, it } from "vitest";
import { makeAdminCategory, makeAdminLayer } from "@/test/factories";
import {
  categoryValidators,
  toFormValues,
  toLayerInput,
  usableCategories,
} from "./layerFormState";

const deforestation = makeAdminCategory();
const protectedAreas = makeAdminCategory({ id: "protected_areas", temporal: false });
const frontier = makeAdminCategory({ id: "frontier", temporal: false, enabled: false });
const categories = [deforestation, protectedAreas, frontier];

describe("layer form category", () => {
  it("starts a new layer without a category", () => {
    expect(toFormValues().category_id).toBe("");
  });

  it("keeps an existing layer's category when saving", () => {
    const layer = makeAdminLayer({ category_id: "protected_areas", baseline: null, compared_against: null });
    expect(toLayerInput(toFormValues(layer), protectedAreas).category_id).toBe(
      "protected_areas"
    );
  });

  it("requires a category the layer can be saved in", () => {
    const { category } = categoryValidators(categories, null);
    expect(category("")).toBe("admin:form:errors:category");
    expect(category("protected_areas")).toBe(true);
    // Disabled, and not the layer's current category
    expect(category("frontier")).toBe("admin:form:errors:categoryInvalid");
    // Doesn't resolve in the country (`unknown_category`)
    expect(category("wetlands")).toBe("admin:form:errors:categoryInvalid");
  });

  it("lets a layer keep its disabled category", () => {
    expect(categoryValidators(categories, "frontier").category("frontier")).toBe(true);
    expect(usableCategories(categories, "frontier").map(({ id }) => id)).toEqual([
      "deforestation",
      "protected_areas",
      "frontier",
    ]);
    expect(usableCategories(categories, null).map(({ id }) => id)).toEqual([
      "deforestation",
      "protected_areas",
    ]);
  });
});

describe("layer form years", () => {
  it("sends the years of a temporal category", () => {
    const input = toLayerInput(toFormValues(makeAdminLayer()), deforestation);
    expect(input.baseline).toBe(2020);
    expect(input.compared_against).toBe(2023);
  });

  it("sends null years for a non-temporal category, whatever was typed", () => {
    // An existing layer moved from deforestation keeps its typed years in the form,
    // but the API refuses years on a non-temporal category.
    const values = { ...toFormValues(makeAdminLayer()), category_id: "protected_areas" };
    const input = toLayerInput(values, protectedAreas);
    expect(input.baseline).toBeNull();
    expect(input.compared_against).toBeNull();
  });

  it("checks the years only for a temporal category", () => {
    const rules = categoryValidators(categories, null);
    const values = { ...toFormValues(), compared_against: "" };
    expect(rules.comparedAgainst("", { ...values, category_id: "deforestation" })).toBe(
      "admin:form:errors:year"
    );
    expect(rules.comparedAgainst("", { ...values, category_id: "protected_areas" })).toBe(
      true
    );
    expect(rules.baseline("2025", { ...values, category_id: "deforestation", compared_against: "2020" })).toBe(
      "admin:form:errors:baselineAfterComparison"
    );
  });
});

describe("layer form pixel size", () => {
  it("starts a new layer at 30 meters", () => {
    expect(toFormValues().pixel_size).toBe("30");
  });

  it("starts an existing layer empty when the index holds no valid pixel size", () => {
    expect(toFormValues(makeAdminLayer({ pixel_size: null })).pixel_size).toBe("");
    expect(toFormValues(makeAdminLayer({ pixel_size: 10 })).pixel_size).toBe("10");
  });
});
