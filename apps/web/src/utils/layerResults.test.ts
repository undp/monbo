import { describe, expect, it } from "vitest";
import { setRuntimeConfig } from "@/config/runtime";
import { makeFarm, makeMapResults } from "@/test/factories";
import {
  classifyResult,
  countResults,
  deforestationRule,
  findingRatio,
  groupFarmsByResult,
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
    // 100 × (1 − 0.99) is 1.0000000000000009 in floating point.
    expect(classifyResult(0.99, required(1))).toBe("ok");
    expect(classifyResult(0.9899, required(1))).toBe("flagged");
  });

  it("flags any finding above 0 with a threshold of 0", () => {
    expect(classifyResult(0, avoid(0))).toBe("ok");
    expect(classifyResult(0.000001, avoid(0))).toBe("flagged");
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
