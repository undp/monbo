import { describe, expect, it } from "vitest";
import { makeMap } from "@/test/factories";
import { layerTextsOf, replaceById, withLayerTexts } from "./layerTexts";

const es = makeMap({
  id: 1,
  alias: "Áreas test",
  source: "Fuente ES",
  considerations: "Notas",
  version: 3,
  pixelSize: 30,
  baseline: 2020,
  comparedAgainst: 2021,
  categoryId: "deforestation",
  references: ["https://example.org"],
});
const en = {
  ...es,
  alias: "Test areas",
  source: "Source EN",
  considerations: "Notes",
  version: 9,
  pixelSize: 10,
  baseline: 1999,
  comparedAgainst: 2000,
  categoryId: "other",
  references: [],
};

describe("withLayerTexts", () => {
  it("replaces only the text fields", () => {
    expect(withLayerTexts(es, layerTextsOf(en))).toEqual({
      ...es,
      alias: "Test areas",
      source: "Source EN",
      considerations: "Notes",
    });
  });

  it("returns the same object for undefined or equal texts", () => {
    expect(withLayerTexts(es, undefined)).toBe(es);
    expect(withLayerTexts(es, layerTextsOf(es))).toBe(es);
  });
});

describe("replaceById", () => {
  const other = makeMap({ id: 2 });

  it("keeps the order and the layers not in `by`", () => {
    const refreshed = { ...es, alias: "New" };
    expect(replaceById([other, es], [refreshed])).toEqual([other, refreshed]);
    expect(replaceById([other, es], [refreshed])[0]).toBe(other);
  });

  it("returns the same array when nothing changed", () => {
    const layers = [other, es];
    expect(replaceById(layers, [es, other])).toBe(layers);
    expect(replaceById(layers, [])).toBe(layers);
  });
});
