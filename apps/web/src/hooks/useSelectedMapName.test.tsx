import { describe, expect, it } from "vitest";
import { makeMap } from "@/test/factories";
import { setSearchParams } from "@/test/navigation";
import { makeDataContext, renderHookWithData } from "@/test/renderWithData";
import { useSelectedMap } from "./useSelectedMapName";

const withMaps = makeDataContext({
  deforestationAnalysisParams: {
    polygonsSubset: "valid",
    selectedMaps: [
      makeMap({ id: 1, name: "Global Forest Watch", alias: "GFW", version: 3 }),
      makeMap({ id: 2, name: "Tropical Moist Forests", alias: "TMF", baseline: 2019 }),
    ],
  },
});

describe("useSelectedMap", () => {
  it("follows the selectedMap search param", async () => {
    setSearchParams({ selectedMap: "2" });
    const { result } = await renderHookWithData(useSelectedMap, { context: withMaps });

    expect(result.current).toMatchObject({ id: 2, alias: "TMF", baseline: 2019 });
  });

  it.each<Record<string, string>>([{}, { selectedMap: "9" }])("falls back to the first layer (%o)", async (params) => {
    setSearchParams(params);
    const { result } = await renderHookWithData(useSelectedMap, { context: withMaps });

    expect(result.current).toEqual({
      id: 1,
      name: "Global Forest Watch",
      alias: "GFW",
      baseline: 2020,
      comparedAgainst: 2023,
      version: 3,
    });
  });

  it("is empty without selected layers", async () => {
    const { result } = await renderHookWithData(useSelectedMap);

    expect(result.current).toEqual({
      id: null,
      name: "",
      alias: "",
      baseline: null,
      comparedAgainst: null,
      version: null,
    });
  });
});
