import { describe, expect, it } from "vitest";
import { makeLayerCategory, makeMap } from "@/test/factories";
import { groupLayersByCategory, layerPeriod } from "./layerCatalog";

const deforestation = makeLayerCategory();
const protectedAreas = makeLayerCategory({ id: "protected_areas", icon: "shield" });
const frontier = makeLayerCategory({ id: "frontier", polarity: "required" });

const gfw = makeMap({ id: 0, categoryId: "deforestation" });
const runap = makeMap({ id: 1, categoryId: "protected_areas" });
const ideam = makeMap({ id: 2, categoryId: "deforestation" });
const orphan = makeMap({ id: 3, categoryId: "wetlands" });

describe("groupLayersByCategory", () => {
  it("puts each layer under its category, in the API's order", () => {
    expect(
      groupLayersByCategory([deforestation, protectedAreas], [gfw, runap, ideam])
    ).toEqual([
      { category: deforestation, layers: [gfw, ideam] },
      { category: protectedAreas, layers: [runap] },
    ]);
  });

  it("keeps a category without layers", () => {
    expect(groupLayersByCategory([deforestation, frontier], [gfw])).toEqual([
      { category: deforestation, layers: [gfw] },
      { category: frontier, layers: [] },
    ]);
  });

  it("lists the layers of an unknown category last, without a category", () => {
    expect(groupLayersByCategory([deforestation], [orphan, gfw])).toEqual([
      { category: deforestation, layers: [gfw] },
      { category: null, layers: [orphan] },
    ]);
  });

  it("returns nothing for a country without categories or layers", () => {
    expect(groupLayersByCategory([], [])).toEqual([]);
  });
});

describe("layerPeriod", () => {
  it("is the content date the country wrote", () => {
    expect(layerPeriod(makeMap({ contentDate: "Entre 2021 y 2022" }))).toBe(
      "Entre 2021 y 2022"
    );
  });

  it("falls back to the layer's years", () => {
    expect(
      layerPeriod(makeMap({ contentDate: null, baseline: 2020, comparedAgainst: 2023 }))
    ).toBe("2020–2023");
  });

  it("is null for a layer without date or years", () => {
    expect(
      layerPeriod(makeMap({ contentDate: null, baseline: null, comparedAgainst: null }))
    ).toBeNull();
  });
});
