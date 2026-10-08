import { describe, expect, it } from "vitest";
import { FarmValidationStatus } from "@/interfaces/PolygonValidation";
import {
  makeFarm,
  makeMap,
  makeMapResults,
  makeValidationResults,
} from "@/test/factories";
import { makeDataContext, renderHookWithData } from "@/test/renderWithData";
import type { DataContextValue } from "@/context/DataContext";
import { useVisibleDataForDeforestationPage } from "./useVisibleDataForDeforestationPage";

// F02 failed polygon validation; F03 has no status (kept as valid).
const farms = [makeFarm({ id: "F01" }), makeFarm({ id: "F02" }), makeFarm({ id: "F03" })];
const results = [
  makeMapResults(1, { F01: 0.1, F02: 0.2, F03: 0 }, 4),
  makeMapResults(2, { F01: 0.3, F02: 0.4, F03: 0.5 }),
];

const context = (
  polygonsSubset: DataContextValue["deforestationAnalysisParams"]["polygonsSubset"],
  overrides: Partial<DataContextValue> = {}
) =>
  makeDataContext({
    farmsData: farms,
    polygonsValidationResults: makeValidationResults({
      F01: FarmValidationStatus.VALID,
      F02: FarmValidationStatus.NOT_VALID,
    }),
    deforestationAnalysisParams: { polygonsSubset, selectedMaps: [makeMap({ id: 1 })] },
    deforestationAnalysisResults: results,
    ...overrides,
  });

const ids = (items: { id: string }[]) => items.map(({ id }) => id);
const farmIds = (items: { farmId: string }[]) => items.map(({ farmId }) => farmId);

describe("useVisibleDataForDeforestationPage", () => {
  it("hides invalid farms and their results when the analysis covers valid polygons", async () => {
    const { result } = await renderHookWithData(useVisibleDataForDeforestationPage, {
      context: context("valid"),
    });

    expect(ids(result.current.farmsData)).toEqual(["F01", "F03"]);
    expect(farmIds(result.current.deforestationAnalysisResults[0].farmResults)).toEqual([
      "F01",
      "F03",
    ]);
  });

  it.each(["all", null] as const)("keeps every farm with polygonsSubset %s", async (subset) => {
    const { result } = await renderHookWithData(useVisibleDataForDeforestationPage, {
      context: context(subset),
    });

    expect(ids(result.current.farmsData)).toEqual(["F01", "F02", "F03"]);
  });

  it("keeps only the selected layers' results, with their version", async () => {
    const { result } = await renderHookWithData(useVisibleDataForDeforestationPage, {
      context: context("all"),
    });

    expect(result.current.deforestationAnalysisResults).toEqual([
      makeMapResults(1, { F01: 0.1, F02: 0.2, F03: 0 }, 4),
    ]);
  });

  it("shows nothing before an analysis", async () => {
    const { result } = await renderHookWithData(useVisibleDataForDeforestationPage, {
      context: context("valid", { deforestationAnalysisResults: null }),
    });

    expect(result.current).toEqual({ farmsData: [], deforestationAnalysisResults: [] });
  });
});
