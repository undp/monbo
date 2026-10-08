import { describe, expect, it } from "vitest";
import { FarmValidationStatus } from "@/interfaces/PolygonValidation";
import { makeFarm, makeMap, makeMapResults, makeValidationResults } from "@/test/factories";
import { makeDataContext, renderHookWithData } from "@/test/renderWithData";
import { useDeforestationFreeResultsCountByMap } from "./useDeforestationFreeResultsCountByMap";
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

describe("useDeforestationFreeResultsCountByMap", () => {
  it("counts the farms with no deforestation per layer, and null when a layer has no data", async () => {
    const { result } = await renderHookWithData(useDeforestationFreeResultsCountByMap, {
      context: makeDataContext({
        farmsData: [makeFarm({ id: "F01" }), makeFarm({ id: "F02" }), makeFarm({ id: "F03" })],
        deforestationAnalysisParams: {
          polygonsSubset: "all",
          selectedMaps: [makeMap({ id: 1 }), makeMap({ id: 2 })],
        },
        deforestationAnalysisResults: [
          makeMapResults(1, { F01: 0, F02: 0.004, F03: 0 }),
          makeMapResults(2, { F01: null, F02: null, F03: null }),
        ],
      }),
    });

    expect(result.current).toEqual([
      { mapId: 1, attr: "map_1", count: 2 },
      { mapId: 2, attr: "map_2", count: null },
    ]);
  });
});
