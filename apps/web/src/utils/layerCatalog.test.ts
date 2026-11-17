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
  it("is the analysis window, with the dataset's range apart", () => {
    expect(
      layerPeriod(
        makeMap({ baseline: 2020, comparedAgainst: 2023, contentDate: "Datos entre 2000 y 2023" })
      )
    ).toEqual({ window: "2020 → 2023", dataRange: "Datos entre 2000 y 2023" });
  });

  it("has only the window when the country wrote no range", () => {
    expect(
      layerPeriod(makeMap({ baseline: 2021, comparedAgainst: 2022, contentDate: null }))
    ).toEqual({ window: "2021 → 2022", dataRange: null });
  });

  it("has only the range for a layer without years", () => {
    expect(
      layerPeriod(
        makeMap({ baseline: null, comparedAgainst: null, contentDate: "Actualizado en 2024" })
      )
    ).toEqual({ window: null, dataRange: "Actualizado en 2024" });
  });

  it("is empty for a layer without years or range", () => {
    expect(
      layerPeriod(makeMap({ contentDate: null, baseline: null, comparedAgainst: null }))
    ).toEqual({ window: null, dataRange: null });
  });
});
