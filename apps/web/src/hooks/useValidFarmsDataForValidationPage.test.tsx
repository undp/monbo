import { describe, expect, it } from "vitest";
import { setRuntimeConfig } from "@/config/runtime";
import { FarmValidationStatus } from "@/interfaces/PolygonValidation";
import {
  makeCategory,
  makeFarm,
  makeMap,
  makeMapResults,
  makeValidationResults,
} from "@/test/factories";
import { makeDataContext, renderHookWithData } from "@/test/renderWithData";
import { useNoObservationsCountByMap } from "./useNoObservationsCountByMap";
import { useValidFarmsDataForValidationPage } from "./useValidFarmsDataForValidationPage";

describe("useValidFarmsDataForValidationPage", () => {
  it("keeps every farm that didn't fail validation", async () => {
    const { result } = await renderHookWithData(useValidFarmsDataForValidationPage, {
      context: makeDataContext({
        farmsData: [makeFarm({ id: "F01" }), makeFarm({ id: "F02" }), makeFarm({ id: "F03" })],
        polygonsValidationResults: makeValidationResults({
          F01: FarmValidationStatus.VALID_MANUALLY,
          F02: FarmValidationStatus.NOT_VALID,
        }),
      }),
    });

    expect(result.current.farmsData.map(({ id }) => id)).toEqual(["F01", "F03"]);
  });

  it("returns no farms before a file is loaded", async () => {
    const { result } = await renderHookWithData(useValidFarmsDataForValidationPage);

    expect(result.current.farmsData).toEqual([]);
  });
});

describe("useNoObservationsCountByMap", () => {
  it("counts the farms at or below the category's threshold per layer, and null when a layer has no data", async () => {
    // The category's threshold (1), not the global one, decides.
    setRuntimeConfig({ deforestationThresholdPercentage: 50, overlapThresholdPercentage: 1 });
    const category = makeCategory({ thresholdPercentage: 1 });
    const { result } = await renderHookWithData(useNoObservationsCountByMap, {
      context: makeDataContext({
        farmsData: [
          makeFarm({ id: "F01" }),
          makeFarm({ id: "F02" }),
          makeFarm({ id: "F03" }),
          makeFarm({ id: "F04" }),
        ],
        territorialAnalysisParams: {
          polygonsSubset: "all",
          selectedMaps: [makeMap({ id: 1 }), makeMap({ id: 2 })],
        },
        territorialAnalysisResults: [
          // 0.004 is below the 1% threshold: free, as the table cell and the map say.
          makeMapResults(1, { F01: 0, F02: 0.004, F03: 0.05, F04: null }),
          makeMapResults(2, { F01: null, F02: null, F03: null, F04: null }),
        ],
        availableCategories: [category],
      }),
    });

    expect(result.current).toEqual([
      { mapId: 1, attr: "map_1", category, count: 2 },
      { mapId: 2, attr: "map_2", category, count: null },
    ]);
  });
});
