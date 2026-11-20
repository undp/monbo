import { describe, expect, it } from "vitest";
import { setRuntimeConfig } from "@/config/runtime";
import {
  formatResultPercentage,
  formatFindingPercentage,
  formatNumber,
  formatOverlapPercentage,
  formatPercentage,
} from "./numbers";

// Values come from the API as unrounded fractions (0-1); thresholds are percents.
const withThresholds = (deforestation: number, overlap = 0) =>
  setRuntimeConfig({
    deforestationThresholdPercentage: deforestation,
    overlapThresholdPercentage: overlap,
  });

describe("formatNumber", () => {
  it("uses each language's separators", () => {
    expect(formatNumber(1234.567, 2, "es")).toBe("1.234,57");
    expect(formatNumber(1234.567, 2, "en")).toBe("1,234.57");
  });

  it("drops trailing zeros", () => {
    expect(formatNumber(48.5, 2, "es")).toBe("48,5");
    expect(formatNumber(48, 2, "en")).toBe("48");
  });
});

describe("formatPercentage", () => {
  it("formats a fraction as a percentage", () => {
    expect(formatPercentage(0.1234, 1, "es")).toBe("12,3%");
    expect(formatPercentage(0.1234, 1, "en")).toBe("12.3%");
    expect(formatPercentage(0.5, 0, "es")).toBe("50%");
  });
});

describe("formatResultPercentage", () => {
  describe("without a threshold", () => {
    it("shows 0 as 0%", () => {
      withThresholds(0);
      expect(formatResultPercentage(0, "es")).toBe("0%");
      expect(formatResultPercentage(0, "en")).toBe("0%");
    });

    it("shows a value below 0.1% as below it, localized", () => {
      withThresholds(0);
      expect(formatResultPercentage(0.0005, "es")).toBe("< 0,1%");
      expect(formatResultPercentage(0.0005, "en")).toBe("< 0.1%");
    });

    it("shows one decimal", () => {
      withThresholds(0);
      expect(formatResultPercentage(0.0283331208, "es")).toBe("2,8%");
      expect(formatResultPercentage(0.0283331208, "en")).toBe("2.8%");
    });
  });

  describe("with a 1% threshold", () => {
    it("keeps one decimal above it", () => {
      withThresholds(1);
      expect(formatResultPercentage(0.014, "es")).toBe("1,4%");
      expect(formatResultPercentage(0.014, "en")).toBe("1.4%");
      expect(formatResultPercentage(0.104999, "es")).toBe("10,5%");
    });

    it("shows a value at or below it as below the threshold", () => {
      withThresholds(1);
      expect(formatResultPercentage(0.004, "es")).toBe("< 1%");
      expect(formatResultPercentage(0.01, "en")).toBe("< 1%");
    });
  });

  describe("with a fractional threshold", () => {
    it("shows as many decimals as the threshold has", () => {
      withThresholds(0.25);
      expect(formatResultPercentage(0.028333, "es")).toBe("2,83%");
      expect(formatResultPercentage(0.028333, "en")).toBe("2.83%");
    });

    it("keeps at least one decimal", () => {
      withThresholds(0.5);
      expect(formatResultPercentage(0.0283331208, "es")).toBe("2,8%");
    });

    it("localizes the below-threshold label", () => {
      withThresholds(0.25);
      expect(formatResultPercentage(0.002, "es")).toBe("< 0,25%");
      expect(formatResultPercentage(0.002, "en")).toBe("< 0.25%");
    });

    it("counts the decimals of a threshold the float stores inexactly", () => {
      withThresholds(0.07);
      expect(formatResultPercentage(0.0005, "es")).toBe("< 0,07%");
      expect(formatResultPercentage(0.00123, "es")).toBe("0,12%");
    });

    it("keeps a tiny threshold and its results from reading as 0%", () => {
      // The API accepts any percentage in 0-100, so a label must never say 0 for a
      // nonzero value: these reach the Excel/GeoJSON exports.
      withThresholds(0.0000001);
      expect(formatResultPercentage(1e-10, "es")).toBe("< 0,0000001%");
      expect(formatResultPercentage(1e-10, "en")).toBe("< 0.0000001%");
      expect(formatResultPercentage(1.5e-9, "en")).toBe("0.0000002%");
      expect(formatResultPercentage(1.5e-9, "es")).toBe("0,0000002%");
    });
  });

  it("shows one decimal with an integer threshold", () => {
    withThresholds(2);
    expect(formatResultPercentage(0.104999, "es")).toBe("10,5%");
    expect(formatResultPercentage(0.0283331208, "en")).toBe("2.8%");
  });
});

describe("formatFindingPercentage", () => {
  it("uses the threshold's decimals, and at least one", () => {
    expect(formatFindingPercentage(0.18, 5, "es")).toBe("18%");
    expect(formatFindingPercentage(0.0244, 2, "es")).toBe("2,4%");
    expect(formatFindingPercentage(0.0244, 2.25, "en")).toBe("2.44%");
  });

  it("never reads a finding above the threshold as the threshold", () => {
    // 5.04% and 5.049% round to 5% with one decimal.
    expect(formatFindingPercentage(0.0504, 5, "es")).toBe("> 5%");
    expect(formatFindingPercentage(0.05049, 5, "es")).toBe("> 5%");
    expect(formatFindingPercentage(0.0504, 5, "en")).toBe("> 5%");
    // Far enough above, the percentage itself.
    expect(formatFindingPercentage(0.0551, 5, "es")).toBe("5,5%");
    expect(formatFindingPercentage(0.051, 5, "es")).toBe("5,1%");
    // A threshold with decimals: 2.2504% rounds to 2.25%.
    expect(formatFindingPercentage(0.022504, 2.25, "es")).toBe("> 2,25%");
    expect(formatFindingPercentage(0.0226, 2.25, "es")).toBe("2,26%");
  });

  it("never reads a finding below the threshold as the threshold", () => {
    expect(formatFindingPercentage(0.0496, 5, "es")).toBe("< 5%");
    expect(formatFindingPercentage(0.049, 5, "es")).toBe("4,9%");
  });

  it("reads a finding on the threshold as the threshold", () => {
    // 100 × 0.05 is a hair above 5 in floating point: still "on" it.
    expect(formatFindingPercentage(0.05, 5, "es")).toBe("5%");
    expect(formatFindingPercentage(1 - 0.95, 5, "es")).toBe("5%");
  });

  it("never reads a finding under the display resolution as 0%", () => {
    expect(formatFindingPercentage(0.0004, 0, "es")).toBe("< 0,1%");
    expect(formatFindingPercentage(0.0004, 0, "en")).toBe("< 0.1%");
    expect(formatFindingPercentage(0.001, 0, "es")).toBe("0,1%");
    expect(formatFindingPercentage(0, 0, "es")).toBe("0%");
  });
});

describe("formatOverlapPercentage", () => {
  it("uses the overlap threshold, not the deforestation one", () => {
    withThresholds(0, 0.5);
    expect(formatOverlapPercentage(0.0033, "es")).toBe("< 0,5%");
    expect(formatOverlapPercentage(0.0033, "en")).toBe("< 0.5%");
    expect(formatOverlapPercentage(0.0283331208, "es")).toBe("2,8%");
  });

  it("shows a value below an integer threshold the same in both languages", () => {
    withThresholds(0, 1);
    expect(formatOverlapPercentage(0.004, "es")).toBe("< 1%");
    expect(formatOverlapPercentage(0.004, "en")).toBe("< 1%");
  });

  it("keeps one decimal above a 1% threshold", () => {
    withThresholds(0, 1);
    expect(formatOverlapPercentage(0.014, "es")).toBe("1,4%");
  });

  it("follows the default display threshold without a threshold", () => {
    withThresholds(0, 0);
    expect(formatOverlapPercentage(0, "es")).toBe("0%");
    expect(formatOverlapPercentage(0.0005, "en")).toBe("< 0.1%");
    expect(formatOverlapPercentage(0.8, "es")).toBe("80%");
  });
});
