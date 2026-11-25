import { describe, expect, it } from "vitest";
import type { TFunction } from "i18next";
import { createTestI18n } from "@/test/i18n";
import {
  makeCategory,
  makeFrontierCategory,
  makeMap,
} from "@/test/factories";
import {
  categoryLayerName,
  findingPercentCell,
  layerResult,
} from "./layerCategories";

const tFor = async (locale: "es" | "en") =>
  (await createTestI18n(locale)).getFixedT(locale) as TFunction;

const deforestation = makeCategory({ thresholdPercentage: 2 });
const frontier = makeFrontierCategory();

describe("layerResult", () => {
  it("reads a required category by what lies outside its layer", async () => {
    const t = await tFor("es");
    const result = layerResult(0.82, frontier, t, "es");
    expect(result.resultClass).toBe("flagged");
    expect(result.finding).toBeCloseTo(0.18);
    expect(result.findingText).toBe("18%");
    expect(result.label).toBe("Fuera de la frontera agrícola");

    expect(layerResult(1, frontier, t, "es")).toMatchObject({
      resultClass: "ok",
      findingText: "0%",
      label: "Dentro de la frontera agrícola",
    });
  });

  it("uses the category's labels in the report's language", async () => {
    const t = await tFor("en");
    expect(layerResult(0.01, deforestation, t, "en")).toMatchObject({
      resultClass: "ok",
      findingText: "< 2%",
      label: "Deforestation-free",
    });
    expect(layerResult(0.05, deforestation, t, "en")).toMatchObject({
      resultClass: "flagged",
      findingText: "5%",
      label: "With deforestation",
    });
  });

  it("says No data for a null or missing result", async () => {
    const t = await tFor("es");
    for (const value of [null, undefined]) {
      expect(layerResult(value, deforestation, t, "es")).toEqual({
        resultClass: "unknown",
        finding: null,
        findingText: "Sin dato",
        label: "Sin dato",
      });
    }
  });

  it("never classifies a layer without a known category", async () => {
    const t = await tFor("en");
    expect(layerResult(0.5, null, t, "en")).toEqual({
      resultClass: "unknown",
      finding: null,
      findingText: "No data",
      label: "No data",
    });
  });
});

describe("categoryLayerName", () => {
  it("names the category and the layer, unescaped", async () => {
    const t = await tFor("es");
    const layer = makeMap({ name: "UPRA & MADR", alias: "UPRA & MADR" });
    expect(categoryLayerName(layer, frontier, t, "es")).toBe(
      "Frontera agrícola · UPRA & MADR"
    );
    expect(categoryLayerName(layer, null, t, "es")).toBe(
      "Sin categoría · UPRA & MADR"
    );
  });
});

describe("findingPercentCell", () => {
  it("is the finding in percent, without floating-point noise", async () => {
    const t = await tFor("es");
    // 1 − 0.82 is 0.18000000000000005
    expect(findingPercentCell(layerResult(0.82, frontier, t, "es"))).toBe(18);
    expect(findingPercentCell(layerResult(0.977, deforestation, t, "es"))).toBe(97.7);
    expect(findingPercentCell(layerResult(0.000015, deforestation, t, "es"))).toBe(
      0.0015
    );
  });

  it("is No data, as text, without a result", async () => {
    const t = await tFor("en");
    expect(findingPercentCell(layerResult(null, deforestation, t, "en"))).toBe(
      "No data"
    );
  });
});
