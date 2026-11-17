import { describe, expect, it } from "vitest";
import { setRuntimeConfig } from "@/config/runtime";
import { isOverlapAboveThreshold } from "./deforestation";

describe("overlap threshold check", () => {
  it("counts a value equal to the threshold as not above it", () => {
    setRuntimeConfig({
      deforestationThresholdPercentage: 1,
      overlapThresholdPercentage: 1,
    });
    expect(isOverlapAboveThreshold(0.01)).toBe(false);
    expect(isOverlapAboveThreshold(0.0101)).toBe(true);
  });

  it("counts any value above 0 with a threshold of 0", () => {
    setRuntimeConfig({
      deforestationThresholdPercentage: 0,
      overlapThresholdPercentage: 0,
    });
    expect(isOverlapAboveThreshold(0)).toBe(false);
    expect(isOverlapAboveThreshold(0.000001)).toBe(true);
  });

  it("reads the overlap threshold, not the deforestation one", () => {
    setRuntimeConfig({
      deforestationThresholdPercentage: 5,
      overlapThresholdPercentage: 0.5,
    });
    expect(isOverlapAboveThreshold(0.01)).toBe(true);
  });
});
