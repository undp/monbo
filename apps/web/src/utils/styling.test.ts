import { describe, expect, it } from "vitest";
import { RESULT_COLORS } from "@/config/theme";
import {
  getResultChipBackgroundColor,
  getResultChipColor,
  resultClassBackgroundColor,
  resultClassColor,
} from "./styling";
import type { ClassificationRule } from "./layerResults";

const avoidRule: ClassificationRule = {
  polarity: "avoid",
  thresholdPercentage: 2,
};

describe("resultClassColor", () => {
  it("paints each class with its own colour", () => {
    expect(resultClassColor("ok")).toBe(RESULT_COLORS.ok);
    expect(resultClassColor("flagged")).toBe(RESULT_COLORS.flagged);
    expect(resultClassColor("unknown")).toBe(RESULT_COLORS.unknown);
  });

  it("paints each class with its own background", () => {
    expect(resultClassBackgroundColor("ok")).toBe(RESULT_COLORS.okBackground);
    expect(resultClassBackgroundColor("flagged")).toBe(
      RESULT_COLORS.flaggedBackground
    );
    expect(resultClassBackgroundColor("unknown")).toBe(
      RESULT_COLORS.unknownBackground
    );
  });
});

describe("result chip colours", () => {
  it("paints a result under the threshold as ok", () => {
    expect(getResultChipColor(0.01, avoidRule)).toBe(RESULT_COLORS.ok);
    expect(getResultChipBackgroundColor(0.01, avoidRule)).toBe(
      RESULT_COLORS.okBackground
    );
  });

  it("paints a result above the threshold as flagged", () => {
    expect(getResultChipColor(0.05, avoidRule)).toBe(RESULT_COLORS.flagged);
    expect(getResultChipBackgroundColor(0.05, avoidRule)).toBe(
      RESULT_COLORS.flaggedBackground
    );
  });

  it("paints a null rule as unknown", () => {
    expect(getResultChipColor(0.05, null)).toBe(RESULT_COLORS.unknown);
    expect(getResultChipBackgroundColor(0.05, null)).toBe(
      RESULT_COLORS.unknownBackground
    );
  });

  it("paints a null value as unknown", () => {
    expect(getResultChipColor(null, avoidRule)).toBe(RESULT_COLORS.unknown);
    expect(getResultChipBackgroundColor(null, avoidRule)).toBe(
      RESULT_COLORS.unknownBackground
    );
  });
});
