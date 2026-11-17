import { describe, expect, it } from "vitest";
import { makeCategory, makeFrontierCategory, makeMap } from "@/test/factories";
import { makeDataContext, renderHookWithData } from "@/test/renderWithData";
import { useLayerRules } from "./useLayerRules";

const frontier = makeFrontierCategory();
const gfw = makeMap({ id: 1 });
const upra = makeMap({ id: 5, categoryId: frontier.id });
const orphan = makeMap({ id: 9, categoryId: "gone" });

describe("useLayerRules", () => {
  it("reads each analysed layer with its category's rule", async () => {
    const { result } = await renderHookWithData(() => useLayerRules(), {
      context: makeDataContext({
        deforestationAnalysisParams: {
          polygonsSubset: "valid",
          selectedMaps: [gfw, upra, orphan],
        },
        availableCategories: [makeCategory(), frontier],
      }),
    });

    expect(result.current(5)).toEqual({
      category: frontier,
      rule: { polarity: "required", thresholdPercentage: 5 },
    });
    expect(result.current(1).rule).toEqual({
      polarity: "avoid",
      thresholdPercentage: 0,
    });
    // Missing category, or a layer that isn't in the analysis: no rule.
    expect(result.current(9)).toEqual({ category: null, rule: null });
    expect(result.current(42)).toEqual({ category: null, rule: null });
    expect(result.current(null)).toEqual({ category: null, rule: null });
  });
});
