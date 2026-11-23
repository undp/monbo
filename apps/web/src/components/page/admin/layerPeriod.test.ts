import { describe, expect, it } from "vitest";
import { makeAdminCategory, makeAdminLayer } from "@/test/factories";
import { layerPeriod } from "./layerPeriod";

const categories = {
  categories: [
    makeAdminCategory(),
    makeAdminCategory({ id: "protected_areas", temporal: false }),
  ],
  readable: true,
  errors: [],
};

describe("layerPeriod", () => {
  it("gives the years of a layer that has both", () => {
    expect(layerPeriod(makeAdminLayer(), categories)).toEqual({
      kind: "years",
      baseline: 2020,
      comparedAgainst: 2023,
    });
  });

  it("is current for a layer without years in a category that is not temporal", () => {
    expect(
      layerPeriod(
        makeAdminLayer({ category_id: "protected_areas", baseline: null, compared_against: null }),
        categories
      )
    ).toEqual({ kind: "current" });
  });

  it.each([
    ["a temporal layer without its years", { baseline: null, compared_against: null }],
    ["a temporal layer with one year", { compared_against: null }],
    [
      "a layer whose category doesn't exist",
      { category_id: "wetlands", baseline: null, compared_against: null },
    ],
    [
      "a layer whose category is broken",
      {
        category_id: "protected_areas",
        category_issue: "invalid_category" as const,
        baseline: null,
        compared_against: null,
      },
    ],
  ])("is unknown for %s", (_, overrides) => {
    expect(layerPeriod(makeAdminLayer(overrides), categories)).toEqual({ kind: "unknown" });
  });

  it("is unknown without a year while the categories haven't loaded", () => {
    expect(
      layerPeriod(makeAdminLayer({ baseline: null, compared_against: null }), null)
    ).toEqual({ kind: "unknown" });
  });
});
