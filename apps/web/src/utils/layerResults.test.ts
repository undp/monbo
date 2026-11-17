import { describe, expect, it } from "vitest";
import { setRuntimeConfig } from "@/config/runtime";
import {
  makeCategory,
  makeFarm,
  makeFrontierCategory,
  makeMap,
  makeMapResults,
} from "@/test/factories";
import {
  categoryRule,
  classifyFarmInCategory,
  classifyResult,
  countResults,
  deforestationRule,
  findingRatio,
  groupFarmsByResult,
  groupLayersByCategory,
  layerCategory,
  layerRule,
  summarizeCategories,
  type ClassificationRule,
} from "./layerResults";

const avoid = (thresholdPercentage: number): ClassificationRule => ({
  polarity: "avoid",
  thresholdPercentage,
});
const required = (thresholdPercentage: number): ClassificationRule => ({
  polarity: "required",
  thresholdPercentage,
});

describe("findingRatio", () => {
  it("is the coverage for avoid and its complement for required", () => {
    expect(findingRatio(0.25, "avoid")).toBe(0.25);
    expect(findingRatio(0.25, "required")).toBe(0.75);
  });
});

describe("classifyResult", () => {
  it("flags an avoid result above the threshold and not one below it", () => {
    expect(classifyResult(0.05, avoid(2))).toBe("flagged");
    expect(classifyResult(0.005, avoid(2))).toBe("ok");
  });

  it("flags a required result by what lies outside the layer", () => {
    expect(classifyResult(0.9, required(5))).toBe("flagged");
    expect(classifyResult(1, required(5))).toBe("ok");
    expect(classifyResult(0, required(5))).toBe("flagged");
    // The same value, opposite answers: a swapped polarity can't go unnoticed.
    expect(classifyResult(0.97, avoid(5))).toBe("flagged");
    expect(classifyResult(0.97, required(5))).toBe("ok");
  });

  it("does not flag a value exactly on the threshold, for either polarity", () => {
    expect(classifyResult(0.01, avoid(1))).toBe("ok");
    expect(classifyResult(0.0101, avoid(1))).toBe("flagged");
    // Raw floating point puts these a hair above the threshold:
    // 100 × 0.07 = 7.000000000000001, 100 × (1 − 0.58) = 42.00000000000001.
    expect(classifyResult(0.07, avoid(7))).toBe("ok");
    expect(classifyResult(0.58, required(42))).toBe("ok");
    expect(classifyResult(0.99, required(1))).toBe("ok");
    expect(classifyResult(0.9899, required(1))).toBe("flagged");
  });

  it("is exact on every threshold in quarter points from 0 to 100", () => {
    for (let quarters = 0; quarters <= 400; quarters++) {
      const threshold = quarters / 4;
      // The value a user would read as "exactly the threshold", as a decimal.
      const onAvoid = Number((threshold / 100).toFixed(4));
      const onRequired = Number((1 - threshold / 100).toFixed(4));
      expect(classifyResult(onAvoid, avoid(threshold))).toBe("ok");
      expect(classifyResult(onRequired, required(threshold))).toBe("ok");
      // One ten-thousandth of a point past it is flagged.
      if (threshold < 100) {
        expect(classifyResult(onAvoid + 1e-6, avoid(threshold))).toBe("flagged");
        expect(classifyResult(onRequired - 1e-6, required(threshold))).toBe(
          "flagged"
        );
      }
    }
  });

  it("flags any finding above 0 with a threshold of 0", () => {
    expect(classifyResult(0, avoid(0))).toBe("ok");
    expect(classifyResult(0.000001, avoid(0))).toBe("flagged");
    expect(classifyResult(1e-12, avoid(0))).toBe("flagged");
  });

  it("keeps tiny thresholds apart from the findings next to them", () => {
    // A threshold of 0.0000001% (the API accepts any percentage).
    expect(classifyResult(1e-9, avoid(1e-7))).toBe("ok");
    expect(classifyResult(1.5e-9, avoid(1e-7))).toBe("flagged");
    expect(classifyResult(1 - 1.5e-9, required(1e-7))).toBe("flagged");
  });

  it("never treats a missing result as a value", () => {
    for (const rule of [avoid(0), avoid(100), required(0), required(100)]) {
      expect(classifyResult(null, rule)).toBe("unknown");
      expect(classifyResult(undefined, rule)).toBe("unknown");
    }
  });
});

describe("deforestationRule", () => {
  it("is avoid with the deforestation threshold from GET /config", () => {
    setRuntimeConfig({
      deforestationThresholdPercentage: 2,
      overlapThresholdPercentage: 7,
    });
    expect(deforestationRule()).toEqual({
      polarity: "avoid",
      thresholdPercentage: 2,
    });
    expect(classifyResult(0.02, deforestationRule())).toBe("ok");
    expect(classifyResult(0.021, deforestationRule())).toBe("flagged");
  });
});

describe("countResults", () => {
  it("counts each class", () => {
    expect(countResults([0, 0.005, 0.02, 0.05, null], avoid(2))).toEqual({
      ok: 3,
      flagged: 1,
      unknown: 1,
    });
  });
});

describe("groupFarmsByResult", () => {
  const farms = ["F01", "F02", "F03", "F04"].map((id) => makeFarm({ id }));

  it("puts a farm with a null result in its own group, not with the clean ones", () => {
    const groups = groupFarmsByResult(
      farms,
      makeMapResults(1, { F01: 0, F02: null, F03: 0.3 }),
      avoid(2)
    );
    expect(groups.ok.map(({ id }) => id)).toEqual(["F01"]);
    expect(groups.flagged.map(({ id }) => id)).toEqual(["F03"]);
    // F02 (null) and F04 (no result for this layer) are unknown.
    expect(groups.unknown.map(({ id }) => id)).toEqual(["F02", "F04"]);
  });

  it("puts every farm in unknown when the layer has no results", () => {
    const groups = groupFarmsByResult(farms, undefined, avoid(2));
    expect(groups.unknown).toHaveLength(4);
    expect(groups.ok).toHaveLength(0);
  });
});

describe("categoryRule and layerRule", () => {
  const frontier = makeFrontierCategory();
  const deforestation = makeCategory({ thresholdPercentage: 10 });
  const categories = [deforestation, frontier];

  it("takes the polarity and threshold of the category", () => {
    expect(categoryRule(frontier)).toEqual({
      polarity: "required",
      thresholdPercentage: 5,
    });
  });

  it("reads a frontier layer with the required rule", () => {
    const rule = layerRule(makeMap({ categoryId: frontier.id }), categories);
    expect(classifyResult(0.9, rule)).toBe("flagged");
    expect(classifyResult(0.96, rule)).toBe("ok");
  });

  it("uses the category's threshold, not the global one", () => {
    setRuntimeConfig({
      overlapThresholdPercentage: 5,
      deforestationThresholdPercentage: 2,
    });
    const rule = layerRule(makeMap({ categoryId: "deforestation" }), categories);
    expect(classifyResult(0.05, rule)).toBe("ok");
  });

  it("gives no rule for a category that is not listed, and unknown results", () => {
    const layer = makeMap({ categoryId: "protected-areas" });
    expect(layerCategory(layer, categories)).toBeNull();
    expect(layerRule(layer, categories)).toBeNull();
    expect(classifyResult(0, null)).toBe("unknown");
    expect(classifyResult(0.9, null)).toBe("unknown");
    expect(countResults([0, 0.5, null], null)).toEqual({
      ok: 0,
      flagged: 0,
      unknown: 3,
    });
  });
});

describe("classifyFarmInCategory", () => {
  it("is flagged when any layer is flagged", () => {
    expect(classifyFarmInCategory(["ok", "flagged"])).toBe("flagged");
    expect(classifyFarmInCategory(["unknown", "flagged"])).toBe("flagged");
  });

  it("is unknown when a layer has no data and none is flagged", () => {
    expect(classifyFarmInCategory(["ok", "unknown"])).toBe("unknown");
    expect(classifyFarmInCategory([])).toBe("unknown");
  });

  it("is ok only when every layer is ok", () => {
    expect(classifyFarmInCategory(["ok", "ok"])).toBe("ok");
  });
});

describe("groupLayersByCategory", () => {
  const frontier = makeFrontierCategory();
  const protectedAreas = makeCategory({ id: "protected-areas" });
  const categories = [makeCategory(), protectedAreas, frontier];

  it("groups in the categories' order, layers by id, and leaves empty ones out", () => {
    const upra = makeMap({ id: 5, categoryId: frontier.id });
    const tmf = makeMap({ id: 2 });
    const gfw = makeMap({ id: 1 });
    const groups = groupLayersByCategory([upra, tmf, gfw], categories);
    expect(groups.map(({ category }) => category?.id)).toEqual([
      "deforestation",
      "agricultural_frontier",
    ]);
    expect(groups[0].layers.map(({ id }) => id)).toEqual([1, 2]);
  });

  it("puts layers of a missing category last, with no category", () => {
    const orphan = makeMap({ id: 3, categoryId: "gone" });
    const groups = groupLayersByCategory([orphan, makeMap({ id: 1 })], categories);
    expect(groups.at(-1)).toEqual({ category: null, layers: [orphan] });
  });
});

describe("summarizeCategories", () => {
  const frontier = makeFrontierCategory();
  const categories = [makeCategory({ thresholdPercentage: 2 }), frontier];
  const layers = [
    makeMap({ id: 1 }),
    makeMap({ id: 2 }),
    makeMap({ id: 5, categoryId: frontier.id }),
    makeMap({ id: 9, categoryId: "gone" }),
  ];
  const farms = ["A", "B", "C", "D"].map((id) => makeFarm({ id }));
  const results = [
    makeMapResults(1, { A: 0, B: 0, C: 0, D: 0.001 }),
    makeMapResults(2, { A: 0, B: 0.3, C: null, D: 0 }),
    makeMapResults(5, { A: 1, B: 0.82, C: 0.96, D: null }),
    makeMapResults(9, { A: 0, B: 0, C: 0, D: 0 }),
  ];

  it("counts each farm once per category, from all its layers", () => {
    const summary = summarizeCategories(farms, results, layers, categories);
    expect(summary.map(({ category }) => category.id)).toEqual([
      "deforestation",
      "agricultural_frontier",
    ]);
    // B is flagged in TMF only; C has no data in TMF; D is under the threshold.
    expect(summary[0]).toMatchObject({
      layerIds: [1, 2],
      counts: { ok: 2, flagged: 1, unknown: 1 },
    });
    // 18 % of B is outside the frontier (above 5); D has no data.
    expect(summary[1]).toMatchObject({
      layerIds: [5],
      counts: { ok: 2, flagged: 1, unknown: 1 },
    });
  });

  it("only summarises analysed layers", () => {
    const summary = summarizeCategories(farms, results.slice(0, 1), layers, categories);
    expect(summary).toHaveLength(1);
    expect(summary[0].layerIds).toEqual([1]);
  });
});
